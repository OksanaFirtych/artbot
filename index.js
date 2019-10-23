const TelegramBot = require('node-telegram-bot-api');
const ogs = require('open-graph-scraper');
const firebase = require('firebase');
const config = require('./config.json');
const LiqPay = require('./liqpay');

const token = config.bot;
const bot = new TelegramBot(token, { polling: true });

const app = firebase.initializeApp(config.firebase);

const ref = firebase.database().ref();
const sitesRef = ref.child('sites');
const liqpay = new LiqPay(config.liqpay.public_key, config.liqpay.private_key);

bot.on('message', (msg) => {
    console.log(msg);
    bot.sendMessage(msg.chat.id, 'Ill have the tuna. No crust.');
});

liqpay.api("request", {
    public_key: config.liqpay.public_key,
    action: "status",
    version: "3",
    order_id: "order_id_1"
}, (json) => {
    console.log(json);
});

bot.onText(/\/pay/, (msg, mathc) => {
    console.log(liqpay);
    console.log(1);
    try {
        liqpay.api('request', {
            public_key: config.liqpay.public_key,
            action: 'invoice_bot',
            version: '3',
            amount: '1',
            currency: 'UAH',
            order_id: 'order_id_1',
            description: 'testtest',
            phone: '79204087203'
        }, function (json) {
            console.log(json);
        });
    } catch (error) {
        console.log(error);
    }
    
    console.log(2);
}, (error) => {
    console.log(3);
    console.log(error);
})

bot.onText(/\/start/, (msg, match) => {
    console.log('start')
    bot.sendMessage(msg.chat.id, 'Hi! What would you like to do?', {
        reply_markup: {
            inline_keyboard: [[
                {
                    text: 'To know more',
                    callback_data: 'info'
                }, {
                    text: 'Pay TUASHO subscription',
                    callback_data: 'payment'
                }, {
                    text: 'Get free news',
                    callback_data: 'free_news'
                }
            ]]
        }
    });
});

bot.onText(/\/info/, (msg, match) => {
    console.log('start')
    bot.sendMessage(msg.chat.id, 'Hi! What would you like to do?', {
        reply_markup: {
            inline_keyboard: [[
                {
                    text: 'To know more',
                    callback_data: 'info'
                }, {
                    text: 'Pay TUASHO subscription',
                    callback_data: 'payment'
                }, {
                    text: 'Get free news',
                    callback_data: 'free_news'
                }
            ]]
        }
    });
});

bot.onText(/\/help/, (msg, match) => {
    console.log('start')
    bot.sendMessage(msg.chat.id, 'Hi! What would you like to do?', {
        reply_markup: {
            inline_keyboard: [[
                {
                    text: 'To know more',
                    callback_data: 'info'
                }, {
                    text: 'Pay TUASHO subscription',
                    callback_data: 'payment'
                }, {
                    text: 'Get free news',
                    callback_data: 'free_news'
                }
            ]]
        }
    });
});

bot.on('callback_query', (callbackQuery) => {
    console.log(callbackQuery);
    switch (callbackQuery.data) {
        case 'info':
            
            break;
        case 'payment':

            break;
        case 'free_news':

            break;
        default:
            break;
    }
    /*const message = callbackQuery.message;
    ogs({ 'url': siteUrl }, function (error, results) {
        if (results.success) {
            sitesRef.push().set({
                name: results.data.ogSiteName,
                title: results.data.ogTitle,
                description: results.data.ogDescription,
                url: siteUrl,
                thumbnail: results.data.ogImage.url,
                category: callbackQuery.data
            });
            bot.sendMessage(message.chat.id, 'Added \'' + results.data.ogTitle + '\' to category \'' + callbackQuery.data + '\'!')
        } else {
            sitesRef.push().set({
                url: siteUrl
            });
            bot.sendMessage(message.chat.id, 'Added new website, but there was no OG data!');
        }
    });*/
});

bot.sendMessage('357213590', 'test.');