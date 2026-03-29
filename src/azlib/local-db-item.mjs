import {produce} from "immer"
import {useState, useEffect, useCallback} from 'react'

import { get as getKV, set as setKV } from 'idb-keyval';
import {userStore, ukeyEncode, ukeyDecode} from './common.mjs'


let seqVar = Promise.resolve()

let in_get = false

export function seqGet(key) {
	console.log(`ask get ${key}`)
	return seqVar = seqVar
			.then(async ()=>{
				//console.log(`get ${key}`, in_get); 
				in_get = true; 
				const cs = await userStore();
				const r = await ukeyDecode(await getKV(key, cs));
				//console.log(`got ${key}`, r); 
				in_get = false; 
				return r;
			})
}

export function seqSave(key, val) {
	console.log(`ask set ${key}`)
	return seqVar = seqVar
			.then(async ()=>{
				//console.log(`set ${key}`);
				const cs = await userStore();
				const r = await setKV(key, await ukeyEncode(val), cs);
				//console.log(`setted ${key}`); 
				return r;
			});
}

export function syncSave() { return seqVar; }


export function useLocalState(key, def, suspend) {
	const [item, setItem] = useState()
	const done = item?.key === key;
	useEffect(()=>{
		if(suspend || done) return;
		seqGet(key)
		.then(val=>{
			if(val!==undefined && val!==null) return val;
			if(typeof def !== 'function') return def;
			return def(key) // async compatible
		})
		.then(val=>setItem({val,key}))
	}, [done, setItem, key, def, suspend])

	const produceItem = useCallback(producer=>{
			setItem(prev=>{
				const next = produce(prev.val, producer)
				seqSave(prev.key, next)
				return {key: prev.key, val: next}
			})
			return syncSave();
		}, [setItem])

	return [done, item?.val, produceItem]
}