import {produce} from "immer"
import {useState, useEffect, useCallback} from 'react'

import { get as getKV, set as setKV } from 'idb-keyval';
import {customStore} from './common.mjs'


let seqVar = Promise.resolve()

let in_get = false

export function seqGet(key) {
	console.log(`ask get ${key}`)
	return seqVar = seqVar
			.then(async ()=>{
				console.log(`get ${key}`, in_get); 
				in_get = true; 
				const cs = await customStore();
				const r = await getKV(key, cs);
				console.log(`got ${key}`, r); 
				in_get = false; 
				return r;
			})
}

export function seqSave(key, val) {
	console.log(`ask set ${key}`)
	return seqVar = seqVar
			.then(async ()=>{
				console.log(`set ${key}`);
				const cs = await customStore();
				const r = await setKV(key, val, cs);
				console.log(`setted ${key}`); 
				return r;
			});
}

export function syncSave() { return seqVar; }


export function useLocalState(key, def, suspend) {
	const [item, setItem] = useState()
	const done = item!==undefined;
	useEffect(()=>{
		if(suspend || done) return;
		seqGet(key)
		.then(val=>{
			if(val!==undefined && val!==null) return val;
			if(typeof def !== 'function') return def;
			return def(key) // async compatible
		})
		.then(setItem)
	}, [done, setItem, key, def, suspend])

	const produceItem = useCallback(producer=>{
			setItem(prev=>{
				const next = produce(prev, producer)
				seqSave(key, next)
				return next
			})
			return syncSave();
		}, [key, setItem])

	return [done, item, produceItem]
}