require('dotenv').config();

const TelegramBot = require('node-telegram-bot-api');
const firebase = require('firebase');
const {
    bot: botToken,
    liqpay_public_key,
    liqpay_private_key,
    admin_chat_id,
    artbot_url,
    apiKey,
    authDomain,
    databaseURL,
    projectId,
    storageBucket,
    messagingSenderId,
    appId,
    measurementId,
} = process.env;
const firebaseConfig = {
    apiKey,
    authDomain,
    databaseURL,
    projectId,
    storageBucket,
    messagingSenderId,
    appId,
    measurementId,
};

const liqPayHelper = require('./liqpay_helper');
const liqpay = liqPayHelper({
    public_key: liqpay_public_key,
    private_key: liqpay_private_key,
});

const constants = require('./constants');
const replace = require('lodash/replace');
const keys = require('lodash/keys');
const get = require('lodash/get');

const {
    CALLBACK_QUERIES,
    HANDLED_MESSAGES_REGS,
} = constants;
const bot = new TelegramBot(botToken, { polling: true });

firebase.initializeApp(firebaseConfig);
const db = firebase.database();
const ref = db.ref();
const chatsRefs = ref.child('chats');

function startChat(msg) {
    const {
        chat,
        date,
        text,
        message_id,
    } = msg;
    const chatObj = {
        chat,
        licensing: {
            value: 0,
            date: date,
        },
        history: [{
            text,
            message_id,
            date,
        }],
    };
    chatsRefs.child(chat.id).set(chatObj);
    bot.sendMessage(
        msg.chat.id,
        'Приветствие, лицензионное соглашение.',
        {
            reply_markup: {
                inline_keyboard: [[
                    {
                        text: 'Принять',
                        callback_data: CALLBACK_QUERIES.ACCEPT_LICENSING,
                    },
                    {
                        text: 'Отклонить',
                        callback_data: CALLBACK_QUERIES.DECLINE_LICENSING,
                    },
                ]]
            }
        }
    );
}

bot.onText(HANDLED_MESSAGES_REGS.START, (msg) => {
    console.log('!!!!!!');
    startChat(msg);
});

bot.on('polling_error', (err) => console.log(err));

function updateLicensing(chatId, value, date) {
    chatsRefs.once('value', (snapshot) => {
        const beforeUpdate = snapshot.val()[chatId];
        chatsRefs.child(chatId).set({
            ...beforeUpdate,
            licensing: {
                date,
                value,
            },
            waiting_number: true,
        });
    });
}

function needPhoneNumber(chatId) {
    bot.sendMessage(
        chatId,
        `Для регистрации напишите свой номер телефона (только цифры).
        Номер телефона необходим, чтобы вы смогли оплачивать ART BOT`,
    );
}

function initPayment(msg) {
    chatsRefs.once('value', (snapshot) => {
        const chatId = msg.chat.id;
        const user = snapshot.val()[chatId];
        liqpay.initPayment(
            msg,
            user,
            {
                onUrlGenerated: (paymentUrl) => {
                    bot.sendMessage(msg.chat.id, `Перейдите по ссылке, чтобы оплатить подписку ${paymentUrl}`);
                },
                onSuccess: ({
                    transaction_id,
                    description
                }) => {
                    bot.sendMessage(admin_chat_id, `Успешный платеж ${transaction_id}. ${description}. Добавить в платный чат`);
                    updateSubscription(chatId, transaction_id);
                },
                onError: () => { },
                onStrange: ({ transaction_id }) => {
                    bot.sendMessage(admin_chat_id, `Проверь транзакцию ${transaction_id}. Странный статус`);
                }
            }
        );
    });
}

bot.on('callback_query', (callbackQuery) => {
    const msg = callbackQuery.message;
    switch (callbackQuery.data) {
        case CALLBACK_QUERIES.ACCEPT_LICENSING:
            updateLicensing(msg.chat.id, 1, msg.date);
            needPhoneNumber(msg.chat.id);
            break;
        case CALLBACK_QUERIES.DECLINE_LICENSING:
            updateLicensing(msg.chat.id, -1, msg.date);
            bot.sendMessage(
                msg.chat.id,
                'Вы отклонили лицензионное соглашение. Мы не можем продолжить работу с вами. Чтобы принять лицензионное соглашение напишие /start',
            );
            break;
        case CALLBACK_QUERIES.PAY:
            initPayment(msg);
            break;
        case CALLBACK_QUERIES.DECLINE_PAY:
            break;
        default:
            if (callbackQuery.data.includes(CALLBACK_QUERIES.ADD_USER)) {
                const chatId = callbackQuery.data.replace(`${CALLBACK_QUERIES.ADD_USER}_`, '');
                bot.sendMessage(
                    chatId,
                    `Спасибо за ожидание. Теперь вы можете перейти в основной канал ${artbot_url}`,
                );
            }
            break;
    }
});

function updatePhoneNumber(chatId, value) {
    chatsRefs.once('value', (snapshot) => {
        const beforeUpdate = snapshot.val()[chatId];
        chatsRefs.child(chatId).set({
            ...beforeUpdate,
            waiting_number: false,
            phone_number: value,
        });
        bot.sendMessage(
            chatId,
            'Вы успешно зарегестрированы',
        );
        offerPayment(chatId);
    });
}

function checkRegistrationStatus(msg, callback) {
    const {
        chat,
        text,
    } = msg;
    chatsRefs.once('value', (snapshot) => {
        const beforeUpdate = get(snapshot.val(), chat.id);
        if (!beforeUpdate) {
            //todo new user without start or failed start;
            startChat(msg);
            callback(false);
            return;
        }

        if (beforeUpdate.licensing.value !== 1) {
            bot.sendMessage(
                chat.id,
                'Примите лицензионное соглашение и зарегестрируйтесь, чтобы продолжить работу. Для этого напишите команду /start',
            );
            setTimeout(() => { startChat(msg); }, 2000);
            callback(false);
            return;
        }

        if (beforeUpdate.waiting_number) {
            const messageWithoutSpace = replace(text, ' ', '');
            const messageWithoutPlus = replace(messageWithoutSpace, '+', '');
            const messageWithoutParents = replace(messageWithoutPlus, '(', '');
            const messageWithoutParents2 = replace(messageWithoutParents, ')', '');
            var numbers = /^[0-9]+$/;
            if (messageWithoutParents2.match(numbers)) {
                updatePhoneNumber(chat.id, messageWithoutParents2);
                callback(true);
                return;
            }

            needPhoneNumber(chat.id);
            callback(false);
            return false;
        }

        callback(true);
    });
}

function offerPayment(chatId) {
    bot.sendMessage(
        chatId,
        'Оплитить подписку сейчас?',
        {
            reply_markup: {
                inline_keyboard: [[
                    {
                        text: 'Оплатить',
                        callback_data: CALLBACK_QUERIES.PAY,
                    },
                    {
                        text: 'Отмена',
                        callback_data: CALLBACK_QUERIES.DECLINE_PAY,
                    },
                ]]
            }
        }
    );
}

bot.onText(HANDLED_MESSAGES_REGS.PAY, (msg) => {
    checkRegistrationStatus(msg, (isRegistered) => {
        if (!isRegistered) {
            return;
        }
        initPayment(msg);
    });
});

const A_MONTHS = 2592000 * 1000;
function updateSubscription(chatId, paymentId) {
    chatsRefs.once('value', (snapshot) => {
        const beforeUpdate = snapshot.val()[chatId];
        const timestamp = new Date().getTime();
        const newSubscription = {
            paymentId,
            timestampStart: timestamp,
            isActive: true,
        };
        let subscriptionHistory = [];
        if (beforeUpdate.subscription) {
            subscriptionHistory = [
                ...(beforeUpdate.subscriptionHistory || []),
                {
                    ...beforeUpdate.subscription,
                },
            ];
            if (beforeUpdate.subscription.timestampExpired > timestamp) {
                newSubscription.timestampStart = beforeUpdate.subscription.timestampExpired + 1;
            }
        }
        newSubscription.timestampExpired = newSubscription.timestampStart + A_MONTHS;
        chatsRefs.child(chatId).set({
            ...beforeUpdate,
            subscription: newSubscription,
            subscriptionHistory,
        });
        const dateExpire = new Date(newSubscription.timestampExpired).toISOString().substr(0, 10);
        bot.sendMessage(chatId, `Подписка оплачена и будет действовать до ${dateExpire}`);
        if (!beforeUpdate.subscription) {
            bot.sendMessage(chatId, `Перейдите по ссылке, чтобы присоединиться к каналу ${artbot_url}`);
        } else if (beforeUpdate.subscription.timestampExpired < timestamp) {
            bot.sendMessage(chatId, 'Подождите пожалуйста. Когда администратор подтвердит ваше возвращение в канал, вам придет ссылка');
            bot.sendMessage(
                admin_chat_id,
                `Убрать из черного списка ${beforeUpdate.chat.username}`,
                {
                    reply_markup: {
                        inline_keyboard: [[
                            {
                                text: 'Добавить',
                                callback_data: `${CALLBACK_QUERIES.ADD_USER}_${chatId}`,
                            },
                            {
                                text: 'Отменить',
                                callback_data: CALLBACK_QUERIES.DECLINE_USER,
                            },
                        ]]
                    }
                }
            );
        }

    });
}

bot.on('message', (msg) => {
    const {
        text,
    } = msg;
    const handledMessagesKey = keys(HANDLED_MESSAGES_REGS);
    const isHandled = handledMessagesKey.some(key => text.match(HANDLED_MESSAGES_REGS[key]));
    if (isHandled) {
        return;
    }

    checkRegistrationStatus(msg, (isRegistered) => {
        if (!isRegistered) {
            return false;
        }
    });
});