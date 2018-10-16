const telegramApi = require( './telegramAPI' );
const request = require('request');
const fs = require('fs');
const apiKey = '932CNNGKXQ97UESA2MZ2H6RTT1WHVMMXYY';
const telegramState = {};
const txTypeTitles = {
  txlist: 'Eth transaction',
  tokentx: 'Token transaction'
};
const trxRequestTypes = ['txlist', 'tokentx'];
const keyboards = {
  'main': {
    keyboard: [
        [{
            text: 'Add'
        },
        {
            text: 'Remove'
        }]
    ],
    resize_keyboard: true,
    one_time_keyboard: false
  }
};
const http = require('http')
const port = 8080;
const server = http.createServer(( req, resp ) => {
  switch ( req.url ) {
    case '/clear':
      state = {
        chats: [],
        addresses: []
      };

      saveState();
      break;
    default:
      fs.readFile('state.json', ( error, content ) => {
        resp.end(content);
      });
  }
});

server.listen(port, (err) => {
    if (err) {
        return console.log('something bad happened', err);
    }
    console.log(`server is listening on ${port}`);
})

let lastBlock = 0;
let state = {};


function getLastBlock() {
  return new Promise( ( resolve ) => {
    request({
      url: 'https://api.etherscan.io/api?module=proxy&action=eth_blockNumber&apikey=' + apiKey
    }, ( error, response, body ) => {
      const data = JSON.parse( body );

      lastBlock = Number( data.result );

      resolve( lastBlock );
    } );

  } );
}

fs.readFile('state.json', ( error, content ) => {
  try {
    state = JSON.parse( content );

    if ( !state || !state.chats || !state.addresses ) {
      state = {
        chats: [],
        addresses: []
      };
    }

  } catch( e ) {
    state = {
      chats: [],
      addresses: []
    };
  }

  let hasChanges = false;

  state.chats.forEach( chat => {
    chat.addresses.forEach( address => {
      if ( !state.addresses.some( a => a.hash === address ) ) {
        state.addresses.push( {
          hash: address,
          lastTransaction: {}
        } );

        hasChanges = true;
      }
    } );
  } );

  if ( hasChanges ) {
    saveState();
  }

  getLastBlock().then(init);
} );

function saveState() {
  fs.writeFile('state.json', JSON.stringify(state, null, 2), () => {} );
}

function startGettingAddress( addressHash ) {
  trxRequestTypes.forEach( txType => {
    sendRequest( addressHash, txType );
  } );
}

function init() {
    telegramApi.instance.on('message', onMessage );

    state.addresses.forEach( a => {
      startGettingAddress( a.hash );
    } );

    console.log( 'initialized' );
};

function objToQuery( obj ) {
  let res = [];

  for ( let key in obj ) {
    res.push(key + '=' + obj[ key ]);
  }

  return res.join('&');
}

function sendRequest( addressHash, txType ) {
  const address = state.addresses.find( a => a.hash === addressHash );

  if ( !address ) {
    console.log( 'ERROR 79');
    return ;
  }

  const lastTransaction = address.lastTransaction[txType];

  const opts = {
    action: txType,
    address: addressHash,
    startBlock: lastTransaction ? Number( lastTransaction.blockNumber ) + 1: lastBlock,
    apikey: apiKey,
    page: 1,
    offset: 100,
    sort: 'desc',
    module: 'account'
  };

  request({
    url: 'http://api.etherscan.io/api?' + objToQuery( opts )
  }, ( error, response, body ) => {
    setTimeout( () => {
      sendRequest( addressHash, txType );
    }, 5000 );

    if ( error ) {
      return ;
    }

    const data = JSON.parse( response.body );

    if ( data.status !== '1' || !data.result.length ) {
      return ;
    }

    data.result.forEach( trx => {
      trx._hash = addressHash;
      trx._type = txType;
      const blockNumber = Number ( trx.blockNumber );

      if ( lastBlock <  blockNumber ) {
        lastBlock = blockNumber;
      }

      sendTransaction( trx );
    } );

    address.lastTransaction[ txType ] = Object.assign( {}, data.result[0] );
    saveState();
  } );
}

function sendTransaction( trx, chatId ) {
  if ( !trx ) {
    return ;
  }

  if ( trx.value == 0 ) {
    return ;
  }

  const tokenDecimal = trx.tokenDecimal ? Number(trx.tokenDecimal): 18;
  const value =  (trx.value / Math.pow( 10, Number( tokenDecimal ) ) ).toFixed( 4 );
  const txType = trx._type;
  const tokenSymbol = txType === 'tokentx' ? trx.tokenSymbol : 'ETH';

  const message = `<b>${value} ${tokenSymbol}</b> <a href="https://etherscan.io/tx/${trx.hash}">link</a>
from: <a href="https://etherscan.io/address/${trx.from}">${trx.from}</a>
to: <a href="https://etherscan.io/address/${trx.to}">${trx.to}</a>`;

  if ( chatId ) {
    sendTransactionMessage( message, chatId );
  } else {
    state.chats.forEach( chat => {
      if ( chat.addresses.indexOf( trx._hash ) !== -1 ) {
        sendTransactionMessage( message, chat.id );
      }
    } );
  }
}

function sendTransactionMessage( message, chatId ) {
  return telegramApi.sendMessage({
    chat_id: chatId,
    text: message,
    parse_mode: 'HTML',
    disable_web_page_preview: 'true',
    reply_markup: JSON.stringify(keyboards.main)
  });
}

function addAddress( chat, addressHash ) {
  let isSaveState = false;
  if ( chat.addresses.indexOf( addressHash ) === -1 ) {
    chat.addresses.push( addressHash );
    isSaveState = true;
  }

  const existAddress = state.addresses.find( a => a.hash === addressHash );

  if ( !existAddress ) {
    const addressObject = {
      hash: addressHash,
      lastTransaction: {}
    };

    state.addresses.push( addressObject );
    isSaveState = true;

    startGettingAddress( addressHash );
  } else {
    trxRequestTypes.forEach( ( t ) => {
      sendTransaction( existAddress.lastTransaction[ t ], chat.id );
    });

  }

  if ( isSaveState ) saveState();
};

function onMessage( message ) {
  let chat;
  switch ( telegramState[ message.chat.id ]  ) {
    case 'ADD_ADDRESS':
      delete telegramState[ message.chat.id ];

      chat = state.chats.find( chat => chat.id === message.chat.id );

      if ( !chat ) {
        chat = {
          id: message.chat.id,
          addresses: []
        }

        state.chats.push( chat );
      }

      addAddress( chat, message.text );
      telegramApi.sendMessage({
        chat_id: message.chat.id,
        text: 'Address was added',
        reply_markup: JSON.stringify(keyboards['main'])
      });
      break;
    case 'REMOVE_ADDRESS':
      delete telegramState[ message.chat.id ];
      chat = state.chats.find( chat => chat.id === message.chat.id );

      if ( !chat ) {
        return ;
      }

      const addressIndex = chat.addresses.findIndex( address => address === message.text );

      if ( addressIndex >= 0 ) {
        chat.addresses.splice( addressIndex, 1 );

        if ( !state.chats.some( chat => {
          return chat.addresses.find( a => a === message.text );
        } ) ) {
          const index = state.addresses.findIndex( a => a.hash === message.text );
          state.addresses.splice( index, 1 );
        }

        telegramApi.sendMessage({
          chat_id: message.chat.id,
          text: 'Address was removed',
          reply_markup: JSON.stringify(keyboards['main'])
        });
      } else {
        telegramApi.sendMessage({
          chat_id: message.chat.id,
          text: 'Error',
          reply_markup: JSON.stringify(keyboards['main'])
        });
      }

      saveState();



      break;
    default:
      switch( message.text ) {
        case '/start':
          if ( !state.chats.some( chat => chat.id === message.chat.id ) ) {
            state.chats.push( {
              id: message.chat.id,
              addresses: []
            } );

            saveState();
          }
          telegramApi.sendMessage({
            chat_id: message.chat.id,
            text: 'Hi. Use menu please',
            reply_markup: JSON.stringify(keyboards['main'])
          });
          break;
        case 'Add':
          telegramState[ message.chat.id ] = 'ADD_ADDRESS';
          telegramApi.sendMessage({
            chat_id: message.chat.id,
            text: 'Enter address',
            reply_markup: JSON.stringify({
                remove_keyboard: true
            })
          });
          break;
        case 'Remove':
          const chat = state.chats.find( chat => chat.id === message.chat.id );

          if ( !chat ) {
            return ;
          }

          telegramState[ message.chat.id ] = 'REMOVE_ADDRESS';

          telegramApi.sendMessage({
            chat_id: message.chat.id,
            text: 'Your addresses\n\n' + chat.addresses.join('\n') + '\n\nEnter address in field for remove',
            reply_markup: JSON.stringify({
                remove_keyboard: true
            })
          });
          break;
        default:
          if ( state.chats.indexOf(message.chat.id) === -1 ) {
            state.chats.push( message.chat.id );
          }
      }
  }
}
