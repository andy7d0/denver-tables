import {sha256}  from  'js-sha256';
import {get as getKV, set as setKV} from 'idb-keyval';
import {customStore} from 'azlib/common.mjs'

function kfPass(login,pass) {
	const kf_pass = sha256(sha256.hmac(login,pass),'key-file-pass') //FIXME: pdfkb or friends
	return window.crypto.subtle.importKey('raw'
		, Uint8Array.fromHex(kf_pass)
		, { name: 'AES-GCM' }
		, false
		, ['encrypt','decrypt'])
}

// fixme: two steps: send mail + 
export async function registerLink(login,pass) {

	const iv = window.crypto.getRandomValues(new Uint8Array(12));
	const kf = window.crypto.getRandomValues(new Uint8Array(32));

	const chipher = await window.crypto.subtle.encrypt(
			{ name: "AES-GCM", 
				iv 
			}
			, await kfPass(login,pass)
			, kf
		)

	const encLogin = (new TextEncoder).encode(login)

	//MOCK, send mail instead
	return new URL(`/register/${encLogin.toHex()}~${iv.toHex()}~${new Uint8Array(chipher).toHex()}`, window.location.href);
}

export async function performRegister(link) {
	const [loginHex,ivHex,chipherHex] = link.split('~')
	const login = (new TextDecoder).decode(Uint8Array.fromHex(loginHex))
	const cs = await customStore(login)
	//MOCK
	if(await getKV('key-file',cs)) return false;
	await setKV('key-file', `${ivHex}.${chipherHex}`, cs)
	return true;
}

export async function tryLogin(login,pass){
	
	// MOCK
	const cs = await customStore(login)
	let kf = await getKV('key-file', cs) ?? ''
	// !MOCK

	const [ivHex = "", textIn = ""] = kf.split('.');

	const plain = await window.crypto.subtle.decrypt(
			{ name: "AES-GCM", iv: Uint8Array.fromHex(ivHex) }
			, await kfPass(login,pass)
			, Uint8Array.fromHex(textIn)
		)

  return window.crypto.subtle.importKey('raw'
    , plain
    , { name: 'AES-GCM' }
    , false
    , ['encrypt','decrypt'])
}

export async function sendToClient(test, clId, login) {
	const pass = sha256.hmac(clId, login)

	const url = new URL(`/cl/${test.meta.bookId}#${pass}.${test.meta.ivHex}`, window.location.href)
	console.log(url)

	await copyTextToClipboard(url.toString())
	
	const ekey = await window.crypto.subtle.importKey('raw'
		, Uint8Array.fromHex(pass)
		, { name: 'AES-GCM' }
		, false
		, ['encrypt','decrypt'])

	test = { meta:test.meta, cl:test.cl??{} }
	const enc = new TextEncoder()
	const msg = enc.encode(JSON.stringify(test))
	const chipher = await window.crypto.subtle.encrypt(
			{ name: "AES-GCM", 
				iv: Uint8Array.fromHex(test.meta.ivHex) 
			}
			, ekey
			, msg
		)

	//MOCK
	await setKV(`to-cl-book-${test.meta.bookId}`, new Uint8Array(chipher).toBase64(), await customStore())
}


export async function clientRead(bookName, hashFragment) {
	if(!hashFragment) return;
	hashFragment = hashFragment.replace('#','')
	const [pass,ivHex] = hashFragment.split('.')
	const iv = Uint8Array.fromHex(ivHex)

	const ekey = await window.crypto.subtle.importKey('raw'
		, Uint8Array.fromHex(pass)
		, { name: 'AES-GCM' }
		, false
		, ['encrypt','decrypt'])

	
	//MOCK
	const textIn = await getKV(`to-cl-${bookName}`, await customStore())
	//

	const plain = await window.crypto.subtle.decrypt(
			{ name: "AES-GCM", iv }
			, ekey
			, Uint8Array.fromBase64(textIn)
		)

	const dec = new TextDecoder()
	const ret = JSON.parse(dec.decode(plain))
	ret.meta.pass = pass;
	await setKV(bookName, ret, await customStore())
	return ret
}

async function copyTextToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text);
    console.log('Text successfully copied to clipboard');
  } catch (err) {
    console.error('Failed to copy text: ', err);
  }
}

export async function sendToTr(test) {
	const pass = test.meta.pass

	const ekey = await window.crypto.subtle.importKey('raw'
		, Uint8Array.fromHex(pass)
		, { name: 'AES-GCM' }
		, false
		, ['encrypt','decrypt'])


	const enc = new TextEncoder()
	const msg = enc.encode(JSON.stringify(test))
	const chipher = await window.crypto.subtle.encrypt(
			{ name: "AES-GCM", 
				iv: Uint8Array.fromHex(test.meta.ivHex) 
			}
			, ekey
			, msg
		)

	//MOCK
	await setKV(`to-tr-book-${test.meta.bookId}`, new Uint8Array(chipher).toBase64(), await customStore())
}



export async function trRead(bookName, clId, login, ivHex) {
	const pass = sha256.hmac(clId, login)

	const ekey = await window.crypto.subtle.importKey('raw'
		, Uint8Array.fromHex(pass)
		, { name: 'AES-GCM' }
		, false
		, ['encrypt','decrypt'])

	
	//MOCK
	const textIn = await getKV(`to-tr-${bookName}`, await customStore())
	//

	if(!textIn) return;

	const uint8In = Uint8Array.fromBase64(textIn)

	const plain = await window.crypto.subtle.decrypt(
			{ name: "AES-GCM", 
				iv: Uint8Array.fromHex(ivHex)
			}
			, ekey
			, uint8In
		)

	const dec = new TextDecoder()
	const ret = JSON.parse(dec.decode(plain))
	return ret.cl;
}
