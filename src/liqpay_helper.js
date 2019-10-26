const LiqPay = require('./liqpay');
const MINUTES_5 = 300 * 1000;
const AN_HOUR = 3600 * 1000;
const A_DAY = 86400 * 1000;

module.exports = function (liqpayCofig) {
    this.liqpay = new LiqPay(liqpayCofig.public_key, liqpayCofig.private_key);

    const checkPayment = (chatId, order_id, start, cb) => () => {
        const timestampNow = new Date().getTime();
        const deltaTime = timestampNow - start;
        this.liqpay.api('request', {
            public_key: liqpayCofig.public_key,
            action: 'status',
            version: '3',
            order_id
        }, (result) => {
            if (!result.status || result.code === 'payment_not_found') {
                if (deltaTime > AN_HOUR) {
                    //an hour passed, transaction isn't started
                    return;
                }
                let checkInterval = 10000;
                if (deltaTime > MINUTES_5) {
                    checkInterval = 30000;
                }
                setTimeout(checkPayment(chatId, order_id, start, cb), checkInterval);
                return;
            }

            if (result.status === 'error' || result.status === 'failure') {
                cb.onError(result);
                return;
            }

            if (result.status === 'success') {
                cb.onSuccess(result);
                return;
            }

            if (deltaTime > A_DAY) {
                cb.onStrange(result);
                return;
            }
        });
    }

    this.initPayment = (msg, user, cb) => {
        const chatId = msg.chat.id;
        const timestamp = new Date().getTime();
        const phone = user.phone_number;
        const description = `payment from ${phone} ${user.chat.username}`;
        const order_id = `${chatId}_${timestamp}`;
        try {
            this.liqpay.api('request', {
                public_key: liqpayCofig.public_key,
                action: 'invoice_bot',
                version: '3',
                amount: '1',
                currency: 'UAH',
                order_id,
                description,
                phone
            }, (json) => {
                cb.onUrlGenerated(json.href);
                setTimeout(checkPayment(msg.chat.id, order_id, timestamp, cb), 5000);
            });
        } catch (error) {
            console.log(error);
        }
    };
    return this;
}