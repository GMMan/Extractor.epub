var backendUrl = 'http://localhost:9080/';

function callBackend(method, query, callback)
{
	return VST.$.ajax({url: backendUrl + method, data: query});
}

function uploadToBackend(path, data)
{
	return VST.$.ajax({url: backendUrl + 'upload?path=' + encodeURIComponent(path), type: 'POST', data: data, processData: false});
}

function downloadData(url)
{
	return VST.$.ajax({url: url, dataType: 'binary', responseType:'arraybuffer', processData: false});
}

function startSession(name)
{
	return callBackend('startsession', {name: name});
}

function endSession(name)
{
	return callBackend('endsession', {name: name});
}

function failSession(name)
{
	setProgress(-1, -1);
	return callBackend('fail', {name: name});
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
	
	var progress = 0;
	var progressMax = 0;
	
	// Download mimetype first to verify EPUB actually exists
	setStatus('Validating EPUB...', 'black');
	downloadData(basePath + 'mimetype')
	// Yay, abusing .then().
	.then(function (mimetype)
	{
		if (uintToString(mimetype) != 'application/epub+zip')
		{
			setStatus('Did not find valid EPUB with that name. Please check that you\'ve typed the name right and have opened the book at least once this session.', 'red');
			setProgress(-1, -1);
			errored = true;
			return reject();
		}
		else
		{
			// mimetype OK, start session
			setStatus('Connecting to backend...', 'black');
			return VST.$.when(startSession(name), mimetype);
		}
	}, function()
	{
		errored = true;
		setStatus('Did not find valid EPUB with that name. Please check that you\'ve typed the name right and have opened the book at least once this session.', 'red');
		setProgress(-1, -1);
	})
	.then(function(o, mimetype)
	{
		return uploadToBackend(basePath + 'mimetype', mimetype);
	}, function()
	{
		if (errored) return;
		errored = true;
		setStatus('Couldn\'t connect to backend. Please make sure backend is running and that http://e.pub is added to Internet Explorer\'s Trusted Sites list.', 'red');
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
		setStatus('Failed to upload mimetype', 'red');
		failSession(name);
	})
	.then(function(container)
	{
		return VST.$.when(uploadToBackend(basePath + 'META-INF/container.xml', container), container);
	}, function()
	{
		if (errored) return;
		errored = true;
		setStatus('META-INF/container.xml not found, can\'t continue.', 'red');
		failSession(name);
	})
	.then(function(o, container)
	{
		var containerXml;
		try
		{
			containerXml = VST.$.parseXML(uintToString(container));
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
		
		var opfPromises = [];
		
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
				return VST.$.when(uploadToBackend(basePath + rootfileName, opf), opf);
			}, function()
			{
				if (errored) return;
				errored = true;
				setStatus('Failed to download package file', 'red');
				failSession(name);
				finalDeferred.reject();
				return finalDeferred.promise();
			})
			.then(function(o, opf)
			{
				var basePathInner = basePath;
				var lastIndexSlash = rootfileName.lastIndexOf('/');
				if (lastIndexSlash >= 0) basePathInner = basePathInner + rootfileName.substring(0, lastIndexSlash) + '/';

				var opfXml;
				try
				{
					opfXml = VST.$.parseXML(uintToString(opf));
				}
				catch (err)
				{
					setStatus('Failed to parse package file', 'red');
					failSession(name);
					errored = true;
					finalDeferred.reject();
					return finalDeferred.promise();
				}
				
				var itemPromises = [];
				
				var items = VST.$(opfXml).find('manifest').first().children();
				progressMax += items.length;
				items.each(function()
				{
					if (errored) return false;
				
					var oneItemDeferred = VST.$.Deferred();
					
					var path = VST.$(this).attr('href');
					downloadData(basePathInner + path)
					.then(function(file)
					{
						setStatus('Transferring ' + path, 'black');
						uploadToBackend(basePathInner + path, file)
					}, function()
					{
						if (errored) return;
						errored = true;
						setStatus('Failed to download ' + path, 'red');
						failSession(name);
					})
					.then(function()
					{
						progress += 1;
						setProgress(progress, progressMax);
						oneItemDeferred.resolve();
					}, function()
					{
						if (errored) return;
						errored = true;
						setStatus('Failed to upload ' + path, 'red');
						failSession(name);
						oneItemDeferred.reject();
					})
					
					itemPromises.push(oneItemDeferred);
				});	

				return VST.$.when.apply(undefined, itemPromises).promise();				
			}, function()
			{
				if (errored) return;
				errored = true;
				setStatus('Failed to upload package file', 'red');
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
		setStatus('Failed to upload META-INF/container.xml', 'red');
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
					return uploadToBackend(basePath + 'META-INF/' + p + '.xml', data);
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
					setStatus('Failed to upload ' + 'META-INF/' + p + '.xml', 'red');
					failSession(name);
					extraPromise.reject();
				});
				
			return extraPromise.promise();
		};
	
		setStatus('Transferring remaining files...', 'black');
		VST.$.when(doExtras('signatures'), doExtras('encryption'), doExtras('metadata'), doExtras('rights'), doExtras('manifest')).promise();
	})
	.then(function()
	{
		setStatus('Done!', 'green');
		return endSession(name);
	});
	
	return null;
}
