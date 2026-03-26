import {sha256}  from  'js-sha256';
import {get as getKV, set as setKV} from 'idb-keyval';
import {customStore} from 'azlib/common.mjs'

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

	const uint8Out = new Uint8Array(chipher)

	//MOCK
	await setKV(`to-cl-book-${test.meta.bookId}`, uint8Out.toBase64(), await customStore())
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

	const uint8In = Uint8Array.fromBase64(textIn)

	const plain = await window.crypto.subtle.decrypt(
			{ name: "AES-GCM", iv }
			, ekey
			, uint8In
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

	const uint8Out = new Uint8Array(chipher)

	//MOCK
	await setKV(`to-tr-book-${test.meta.bookId}`, uint8Out.toBase64(), await customStore())
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
