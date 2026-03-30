<?php
\define_api_route(function($link){
	, sendToClient: async (fname, fileData) => setKV(fname, fileData, await customStore())
});

const MOCK_API = {
	, trRead: async fname => getKV(fname, await customStore())
}
