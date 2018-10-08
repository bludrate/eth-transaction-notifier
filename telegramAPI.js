const Telegram = require('./telegram-bot');
//const userApi = require( './core/userAPI' );
const api = new Telegram({
    token: '652901848:AAG9Epzn0gVcB-7ZtjGwHL0U5sa1UGTtvAQ',
    updates: {
        enabled: true
    }
});

module.exports = {
    instance: api,
    sendPhoto: function( telegramOpts, params ) {
        return api.sendPhoto( telegramOpts )
            .then( data => {
                //console.log( 'message successfully sent', data );
                return data;
            } )
            .catch( error => {
                //console.log( 'error while sending message', error );
                if ( params && params.isInfoMessage ) {
                    //save info message in db and send in later
                }
            } )
    },

    editMessageText: function( telegramOpts, params ) {
        return api.editMessageText( telegramOpts )
            .then( data => {
                //console.log( 'message successfully sent', data );
                return data;
            } )
            .catch( error => {
                //console.log( 'error while sending message', error );
                if ( params && params.isInfoMessage ) {
                    //save info message in db and send in later
                }
            } )
    },
    /*sendToAll: function( text ) {
        return userApi.find({})
            .then( users => {
                return Promise.all( users.map( user => {
                    this.sendMessage( {
                        chat_id: user.chatId,
                        text: text
                    } );
                } ) );
            } )
    },*/
    sendMessage: function( telegramOpts, params ) {
        return api.sendMessage( telegramOpts )
            .then( data => {
                //console.log( 'message successfully sent', data );
                return data;
            } )
            .catch( error => {
                //console.log( 'error while sending message', error );
                if ( params && params.isInfoMessage ) {
                    //save info message in db and send in later
                }
            } )
    }
}
