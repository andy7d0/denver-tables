import {sha256}  from  'js-sha256';
import {get as getKV, set as setKV} from 'idb-keyval';
import {customStore} from 'azlib/common.mjs'

export async function sendToClient(test, clId, login) {
	const pass = sha256.hmac(clId, login)
	const iv = window.crypto.getRandomValues(new Uint8Array(12));

	const url = new URL(`/cl/${test.meta.bookId}#${pass}.${iv.toHex()}`, window.location.href)
	console.log(url)

	await copyTextToClipboard(url.toString())
	
	//MOCK

	const ekey = await window.crypto.subtle.importKey('raw'
		, Uint8Array.fromHex(pass)
		, { name: 'AES-GCM' }
		, false
		, ['encrypt','decrypt'])


	const enc = new TextEncoder()
	const msg = enc.encode(JSON.stringify(test))
	const chipher = await window.crypto.subtle.encrypt(
			{ name: "AES-GCM", iv }
			, ekey
			, msg
		)

	const uint8Out = new Uint8Array(chipher)

	await setKV(`to-cl-book-${test.meta.bookId}`, uint8Out.toBase64(), await customStore())
}


export async function clientRead(bookName, hashFragment) {
	hashFragment = hashFragment.replace('#','')
	const [pass,ivHex] = hashFragment.split('.')
	const iv = Uint8Array.fromHex(ivHex)

	//MOCK
	const ekey = await window.crypto.subtle.importKey('raw'
		, Uint8Array.fromHex(pass)
		, { name: 'AES-GCM' }
		, false
		, ['encrypt','decrypt'])

	
	const textIn = await getKV(`to-cl-${bookName}`, await customStore())
	const uint8In = Uint8Array.fromBase64(textIn)

	const plain = await window.crypto.subtle.decrypt(
			{ name: "AES-GCM", iv }
			, ekey
			, uint8In
		)

	const dec = new TextDecoder()
	return JSON.parse(dec.decode(plain))
}

async function copyTextToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text);
    console.log('Text successfully copied to clipboard');
  } catch (err) {
    console.error('Failed to copy text: ', err);
  }
}
