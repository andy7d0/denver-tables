<?php
\define_api_route(function($login){
	$dir = \az\settings\normFileName($login);
	$dir = \az\settings\STORAGE."/$dir";
	return file_get_contents("$dir/key-file"); 
}
,__FILE__);
