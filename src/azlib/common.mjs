import {sha256}  from  'js-sha256';
import {bytesToBase64URL, base64decode} from './b64.mjs';

import { get as getKV, set as setKV, del as delKV, update as updateKV } from 'idb-keyval';
import {openDB, unwrap} from 'idb';
import {toServerTime} from './date.mjs';

let peerCode = null;
let windowId = null;
let lastTime = 0;
let idInIime = 0;
let currentBranch = '';

// eslint-disable-next-line no-restricted-globals 
const hostname = self.location.hostname;

export function getPeerCode() {
  return peerCode;
}
export function getWindowId() {
  return windowId;
}

async function branch_from_header() {
  let r = await fetch('/', {method:"HEAD", cache:"force-cache"})
  return r.headers.get("Req-Magic-Switch")
}


console.log(`hostname: ${hostname}`);

export function getCurrentBranch() {
  return isLocalServer() && 'debug'
    || !isDevServer() && 'production'
    || currentBranch 
    ;
}

export async function DB(prefix) {
  return openDB(`${prefix??''}/${getCurrentBranch()}.app`, 1, {
  upgrade(db, oldVersion, _newVersion, _transaction, _event) {
    /* eslint-disable-next-line default-case */
    //console.log(oldVersion, newVersion)
    // eslint-disable-next-line default-case
    switch(oldVersion||0) {
      case 0:{
        db.createObjectStore('keyval')
        db.createObjectStore('keygen', { autoIncrement : true })
        // const docs = db.createObjectStore('docs')
        //   docs.createIndex('doctype','doctype')
        }
      //
      // ..etc  
    }
  },
  blocked(_currentVersion, _blockedVersion, _event) {
    // …
  },
  blocking(_currentVersion, _blockedVersion, _event) {
    // …
  },
  terminated() {
    // …
  },
})
};

export async function customStore(prefix) {
  let db = unwrap(await DB(prefix));
  return (txMode, callback) => 
          callback(db.transaction('keyval', txMode).objectStore('keyval'))
}

/**
 * subscribe to login state changed!
 */

let loginState = await getKV('login-state', await customStore())

export function getLoggedState() {
  return loginState  // use local (per branch) store
}

export async function getAPIparams() {
  const at = await getKV('login-state', await customStore()) // use local (per branch) store
  const peer = getPeerCode()
  return { integrity: at && sha256.hmac(at.authorization, peer ) || ''
          , token: at?.authorization
          , peer: peer
        }
}

export function userStore() { return customStore(loginState?.uinfo?.login??'') }
function userUkey() { return loginState?.uinfo?.ukey }

export async function ukeyEncode(data) {
  data = JSON.stringify(data)
  const ukey = userUkey()

  const iv = window.crypto.getRandomValues(new Uint8Array(12));
  const chipher = await window.crypto.subtle.encrypt(
      { name: "AES-GCM", 
        iv 
      }
      , ukey
      , (new TextEncoder).encode(data)
    )

  return `${iv.toHex()}~${new Uint8Array(chipher).toBase64()}`
}

export async function ukeyDecode(data) {
  if(!data) return data;
  const ukey = userUkey()
  const [ivHex, b64data] = data.split('~')

  const iv = window.crypto.getRandomValues(new Uint8Array(12));
  const plain = await window.crypto.subtle.decrypt(
      { name: "AES-GCM", 
        iv: Uint8Array.fromHex(ivHex)
      }
      , ukey
      , Uint8Array.fromBase64(b64data)
    )

  return JSON.parse((new TextDecoder).decode(plain))
}

  // const plain = await window.crypto.subtle.decrypt(
  //     { name: "AES-GCM", iv: Uint8Array.fromHex(ivHex) }
  //     , await kfPass(login,pass)
  //     , Uint8Array.fromHex(textIn)
  //   )


/**
 *  state:
 *    subscription: key to subscribe on server
 *    authorization: header to send with requests
 */
export async function setAuthToken(auth) {
  loginState = auth;
  if(!auth) {
    await delKV('login-state', await customStore())
  } else {
    await setKV('login-state', auth, await customStore())
  }
  broadcast('auth', auth)
}

export function isExactLocahost() {
  return hostname === '127.0.0.1' 
  || hostname === 'localhost'
  ;  // hardcoded, KISS  
}

export function isLocalServer() {
  return hostname.match(/^127[.]\d+[.]\d+[.]1$/) 
  || hostname === 'localhost'
  ;  // hardcoded, KISS
}

export function isProdDomain() {
  return hostname === 'prod.domain'; // hardcoded, KISS
}

function isProdServer() {
  return isProdDomain() || hostname === 'prod-ip-address'; // hardcoded, KISS
}

export function isDevServer() {
  return !window.localStorage.getItem('dev-as-prod') && !isProdServer(); 
}

export function asProdServer(asProd) {
  if(asProd === undefined) return window.localStorage.getItem('dev-as-prod')
  if(asProd) window.localStorage.setItem('dev-as-prod', 'Y')
  else window.localStorage.removeItem('dev-as-prod')
}

export function api_url(url) {
  if(url[0]!=='/') url = `/${url}`
  if(!url.startsWith('/app/')) url = `/app/${url}`
  if(url.startsWith('/app/common/')) {
    const loc = window.location.href;
    if(loc.startsWith('/app/int/')||loc.startsWith('/int/')) {
      url = url.replace('/app/common/', '/app/int/')
    } else
    if(loc.startsWith('/app/par/')||loc.startsWith('/par/')) {
      url = url.replace('/app/common/', '/app/par/')
    } else
    if(loc.startsWith('/app/ext/')||loc.startsWith('/ext/')) {
      url = url.replace('/app/common/', '/app/ext/')
    } else 
      url = url.replace('/app/common/', '/app/ext/') // default!
  }
  return url;
}


export async function initPeerAndID() {
  await updateKV('ids', codes => {
    console.log('on init peer')
    if(codes) {
      console.log('peer already inited')
    } else {
      let peerCode = new Uint8Array(32);
      // eslint-disable-next-line no-restricted-globals
      self.crypto.getRandomValues(peerCode);
      peerCode = bytesToBase64URL(peerCode);
      console.log('peer inited')
      codes = { peerCode, winId: 0 }
    }
    ++codes.winId;
    peerCode = codes.peerCode;
    windowId = codes.winId;
    broadcastOthers('otherWindows', {windowId})
    console.log(codes)
    return codes;
  }, await customStore())
  currentBranch = await branch_from_header()
}

export function getLocalUniqueCode() {
  const tm = Date.now().toFixed(0);
  if(lastTime === tm) {
    return {win: windowId, time: lastTime, inc: idInIime++ };
  } else {
    return {win: windowId, time: (lastTime = tm), inc: (idInIime=1)};
  }
}

export function getGlobalUniqueCode() {
  const peer = getPeerCode();
  const lc = getLocalUniqueCode();
  lc.time = toServerTime(lc.time).toFixed(0); // to server time
  return `${lc.time}.${lc.inc}.${lc.win}.${peer}`;
}


let listeners = {}
export function subscribe(code, fun) {
  const prev = listeners[code]
  if(fun) listeners[code] = fun;
  else delete listeners[code];
  return () => subscribe(code, prev);
}

let channel = new BroadcastChannel('bc-main') // from worker to main
// eslint-disable-next-line prefer-add-event-listener
channel.onmessage = event => {
  listeners[event.data.code]?.(event.data, event)
}

export function broadcastOthers(code, data) {
  const msg = {...data, code}
  // eslint-disable-next-line  require-post-message-target-origin
  channel.postMessage(msg)
}

export function broadcast(code, data) {
  const msg = {...data, code}
  defer(msg).then(event=>listeners[code]?.(event))
  // eslint-disable-next-line  require-post-message-target-origin
  channel.postMessage(msg)
}


const otherWindowsHolder = {}

subscribe('otherWindows', ({windowId:otherId}, event)=>{
  // when new window open
  otherWindowsHolder[otherId] = event.source;
  // send our id is back to newly open window
  broadcastOthers('otherWindowsBack', {windowId})
})
subscribe('otherWindowsBack', ({windowId}, event)=>{
  otherWindowsHolder[windowId] = event.source;
})

export function otherWindows() {
  return Object.values(otherWindowsHolder).filter(w=>w && !w.closed);
  // TODO: remove closed from stored
}

/*
  global:
  peer-code
  auth-token реально глобальный

  local to database branch
  PersonCache

  откуда мы узначем branch?
  лучше всего - из базы
  auth-token - роли в конкретной базе (это такая кука, нужная только серверу)

  база может быть или не быть совместимой с текущей

  сервер всегда(?)

  откуда мы узначем сервер?
  по идее, из выбора для сервера
  этот выбор должен работать без программы,
  т.о. только браузер
  в принципе, настройки браузера можно читать
  очевидная cookie
  сложнее (и как вообще) - host
  ip требует proxy, но зато не нужно ничего менять

  также, мы выбираем ветку + базу!
  по идее
    локальная ветка + локальная база
    локальная ветка + глобальная база (по выбору из совместимых)
    глобальная ветка + ее база
    глоблальная ветка + база по выбору

  на сервер приходит пара: ветка+база (или просто ветка? - тогда ее база)
  на клиенте ветка фикс в разработаке (явно ставится в проксировании)
  а база выбираемая из допустимых (фиксированный список)

  на веб-браузере ветка и база приходят из куки

  сервер также может ставить куку (по идее) - так упрощается код (наверное)

  таким образом, /x управляет ТОЛЬКО глобальной кукой сервера
  а куку базы мы выставляем отдельно

*/
