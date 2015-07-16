function downloadData(url)
{
	return VST.$.ajax({url: url, dataType: 'binary', responseType:'arraybuffer', processData: false});
}

function failSession(name)
{
	setProgress(-1, -1);
}

function setStatus(status, color)
{
	if (setStatus_page) setStatus_page(status, color);
}

function setProgress(prog, max)
{
	if (setProgress_page) setProgress_page(prog, max);
}

// https://stackoverflow.com/a/12713326/1180879
function Uint8ToString(u8a)
{
	var CHUNK_SZ = 0x8000;
	var c = [];
	for (var i=0; i < u8a.length; i+=CHUNK_SZ) {
		c.push(String.fromCharCode.apply(null, u8a.subarray(i, i+CHUNK_SZ)));
	}
	return c.join("");
}

function uintArrayToString(buf) {
	var uintArray = new Uint8Array(buf);
	// Some files are really large and causes stack overflow if you do it in one go.
	// So use new chunked function.
	var encodedString = Uint8ToString(uintArray),
		decodedString = decodeURIComponent(escape(encodedString));
	return decodedString;
}

// http://stackoverflow.com/a/18729536/1180879
function stringToBuffer(str) {
	var utf8 = unescape(encodeURIComponent(str));

	var arr = [];
	for (var i = 0; i < utf8.length; i++) {
		arr.push(utf8.charCodeAt(i));
	}
	
	return arr;
}

function resolve()
{
	var d = VST.$.Deferred();
	d.resolve();
	return d.promise();
}

function extract(name)
{
	name = name.toLowerCase();
	var basePath = '/' + name + '/';
	var errored = false;
	var finalDeferred = VST.$.Deferred();
	var zipFile;
	
	var progress = 0;
	var progressMax = 0;
	
	// Download mimetype first to verify EPUB actually exists
	setStatus('Validating EPUB...', 'black');
	downloadData(basePath + 'mimetype')
	// Yay, abusing .then().
	.then(function (mimetype)
	{
		if (uintArrayToString(mimetype) != 'application/epub+zip')
		{
			setStatus('Did not find valid EPUB with that name. Please check that you\'ve typed the name right and have opened the book at least once this session.', 'red');
			setProgress(-1, -1);
			errored = true;
			return reject();
		}
		else
		{
			// mimetype OK, start session
			zipFile = new JSZip();
			return mimetype;
		}
	}, function()
	{
		errored = true;
		setStatus('Did not find valid EPUB with that name. Please check that you\'ve typed the name right and have opened the book at least once this session.', 'red');
		setProgress(-1, -1);
	})
	.then(function(mimetype)
	{
		zipFile.file('mimetype', mimetype, {binary: true, compression: 'STORE'});
	}, function()
	{
		if (errored) return;
		errored = true;
		setStatus('Failed to create new ZIP file.', 'red');
		failSession(name);
	})
	.then(function()
	{
		// Get container
		setStatus('Parsing container.xml...', 'black');
		return downloadData(basePath + 'META-INF/container.xml');
	}, function()
	{
		if (errored) return;
		errored = true;
		setStatus('Failed to add mimetype', 'red');
		failSession(name);
	})
	.then(function(container)
	{
		zipFile.file('META-INF/container.xml', container, {binary: true, compression: 'DEFLATE'});
		return VST.$.when(container);
	}, function()
	{
		if (errored) return;
		errored = true;
		setStatus('META-INF/container.xml not found, can\'t continue.', 'red');
		failSession(name);
	})
	.then(function(container)
	{
		var containerXml;
		try
		{
			containerXml = VST.$.parseXML(uintArrayToString(container));
		}
		catch (err)
		{
			if (errored) return;
			errored = true;
			setStatus('Failed to parse container.xml', 'red');
			failSession(name);
			finalDeferred.reject();
			return finalDeferred;
		}
		
		var opfPromises = []; // TODO: chain OPF processing as well
		
		// Process each file in container.xml
		VST.$(containerXml).find('rootfile').each(function()
		{
			if (errored) return false;
			var opfDeferred = VST.$.Deferred();

			var rootfileName = VST.$(this).attr('full-path');
			setStatus('Parsing ' + rootfileName + '...', 'black');
			downloadData(basePath + rootfileName)
			.then(function(opf)
			{
				zipFile.file(rootfileName, opf, {binary: true, compression: 'DEFLATE'});
				return VST.$.when(opf);
			}, function()
			{
				if (errored) return;
				errored = true;
				setStatus('Failed to download package file', 'red');
				failSession(name);
				finalDeferred.reject();
				return finalDeferred.promise();
			})
			.then(function(opf)
			{
				var basePathInner = basePath;
				var baseZipPath = '';
				var lastIndexSlash = rootfileName.lastIndexOf('/');
				if (lastIndexSlash >= 0)
				{
					baseZipPath = rootfileName.substring(0, lastIndexSlash) + '/';
					basePathInner = basePathInner + baseZipPath;
				}

				var opfXml;
				try
				{
					opfXml = VST.$.parseXML(uintArrayToString(opf));
				}
				catch (err)
				{
					setStatus('Failed to parse package file', 'red');
					failSession(name);
					errored = true;
					finalDeferred.reject();
					return finalDeferred.promise();
				}
				
				var items = VST.$(opfXml).find('manifest').first().children();
				progressMax += items.length;
				var prevDeferred = VST.$.Deferred() // Try chaining Deferred instead of firing them all at once
				var finalDeferred = VST.$.Deferred();
				if (items.length > 0) {
					var procNextItem = function(index) {					
						var theItem = items[index];
							var path = VST.$(theItem).attr('href');
						return downloadData(basePathInner + path)
						.then(function(file) {
							setStatus('Transferring ' + path, 'black');
							// For HTML/XHTML, convert to string, remove junk, then convert back
							var mediaType = VST.$(theItem).attr('media-type');
							if (mediaType === 'text/html' || mediaType === 'application/xhtml+xml')
							{
								// Some publishers and/or VitalSource fill in text/html for unknown files, and this causes exceptions.
								// This is a good thing, because then we can catch and won't mangle the file. But seriously, get your shit together already.
								try
								{
									var content = uintArrayToString(file);
									content = content.replace(/<script type='text\/javascript'> if.+?<\/script>/g, '')
										.replace(/<script src='http:\/\/e.pub\/.+?<\/script>/g, '')
										.replace(/<script type='text\/javascript'> window.console =.+?<\/script>/g, '')
										.replace(/<script>var VST.+?<\/script>/g, '');
									file = stringToBuffer(content);
								}
								catch (err)
								{ }
							}
							zipFile.file(baseZipPath + path, file, {binary: true, compression: 'DEFLATE'});
						}, function()
						{
							if (errored) return;
							errored = true;
							setStatus('Failed to download ' + path, 'red');
							failSession(name);
							finalDeferred.reject();
						})
						.then(function() {
							progress += 1;
							setProgress(progress, progressMax);
							if (index + 1 < items.length) {
								prevDeferred = prevDeferred.then(procNextItem);
								return index + 1;
							} else {
								finalDeferred.resolve();
							}							
						}, function() {
							if (errored) return;
							errored = true;
							setStatus('Failed to add ' + path, 'red');
							failSession(name);
							finalDeferred.reject();
						});
					}
					
					prevDeferred.resolve(0);
					prevDeferred = prevDeferred.then(procNextItem);
				} else {
					finalDeferred.resolve();
				}

				return finalDeferred.promise();				
			}, function()
			{
				if (errored) return;
				errored = true;
				setStatus('Failed to add package file', 'red');
				failSession(name);
			})
			.then(function()
			{
				opfDeferred.resolve();
			}, function()
			{
				opfDeferred.reject();
			});
			
			opfPromises.push(opfDeferred);
		});
		
		return VST.$.when.apply(undefined, opfPromises).promise()
	}, function()
	{
		if (errored) return;
		errored = true;
		setStatus('Failed to add META-INF/container.xml', 'red');
		failSession(name);
	})
	.then(function()
	{
		doExtras = function(p)
		{
			var extraPromise = VST.$.Deferred();
			var hasExtra = false;
			
			downloadData(basePath + 'META-INF/' + p + '.xml')
			.then(function(data)
			{
				hasExtra = true;
				zipFile.file('META-INF/' + p + '.xml', data, {binary: true, compression: 'DEFLATE'});
			}, function()
			{
				extraPromise.resolve();
			})
			.then(function()
			{
				extraPromise.resolve();
			}, function()
			{
				if (errored || !hasExtra) return;
				errored = true;
				setStatus('Failed to add ' + 'META-INF/' + p + '.xml', 'red');
				failSession(name);
				extraPromise.reject();
			});
				
			return extraPromise.promise();
		};
	
		setStatus('Adding remaining files...', 'black');
		VST.$.when(doExtras('signatures'), doExtras('encryption'), doExtras('metadata'), doExtras('rights'), doExtras('manifest')).promise();
	})
	.then(function()
	{
		setStatus('Done!', 'green');
		var zipResult = zipFile.generate({type:"blob"});
		saveAs(zipResult, name + '.epub');
	});
	
	return null;
}
