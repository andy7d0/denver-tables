<?php
\define_api_route(function($fname){
	if(!str_starts_with($fname, 'to-cl-book-')) { throw new ResourceNotFound(); }
	$file = \az\settings\normFileName($fname);
	$file = \az\settings\STORAGE."/_/$file";
	return file_get_contents($file); 
});
