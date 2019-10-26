module.exports = {
    CALLBACK_QUERIES: {
        ACCEPT_LICENSING: 'accept_licensing',
        DECLINE_LICENSING: 'decline_licensing',
        PAY: 'pay',
        DECLINE_PAY: 'decline_pay',
        ADD_USER: 'add_user',
        DECLINE_USER: 'decline_user',
    },
    HANDLED_MESSAGES_REGS: {
        START: /\/start/,
        PAY: /\/pay/,
    }
};
