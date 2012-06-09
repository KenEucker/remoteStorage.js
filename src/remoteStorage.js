define(
  ['require', './lib/platform', './lib/couch', './lib/dav', './lib/simple', './lib/webfinger', './lib/hardcoded', './lib/widget'],
  function (require, platform, couch, dav, simple, webfinger, hardcoded, widget) {
    var createStorageInfo = function(href, type, properties) {
        var nodirs = (type.substring(0, 'https://www.w3.org/community/rww/wiki/read-write-web-00'.length) != 'https://www.w3.org/community/rww/wiki/read-write-web-00');
        return {
          href: href,
          type: type,
          nodirs: nodirs,
          properties: properties
        }
      },
      getStorageInfo = function (userAddress, cb) {
        if(typeof(userAddress) != 'string') {
          cb('user address should be a string');
        } else {
          webfinger.getStorageInfo(userAddress, {timeout: 3000}, function(err, data) {
            if(err==404 || err=='timeout') {
              hardcoded.guessStorageInfo(userAddress, {timeout: 3000}, function(err2, data2) {
                var storageInfo;
                try {
                  createStorageInfo(data2.href, data2.type, data2.properties);
                } catch(e) {
                }
                cb(err2, storageInfo);
              });
            } else {
              cb(err, createStorageInfo(data.href, data.type, data.properties));
            }
          });
        }
      },
      createOAuthAddress = function (storageInfo, scopes, redirectUri) {
        if(storageInfo.type=='https://www.w3.org/community/rww/wiki/read-write-web-00#simple') {
          scopesStr = scopes.join(' ');
        } else {
          var legacyScopes = [];
          for(var i=0; i<scopes.length; i++) {
            legacyScopes.push(scopes[i].split(':')[0].split('/')[0]);
          }
          scopesStr = legacyScopes.join(',');          
        }
        var hostAndRest;
        if(redirectUri.substring(0, 'https://'.length) == 'https://') {
          hostAndRest = redirectUri.substring('https://'.length);
        } else if(redirectUri.substring(0, 'http://'.length) == 'http://') {
          hostAndRest = redirectUri.substring('http://'.length);
        } else {
          throw new Error('redirectUri does not start with https:// or http://');
        }
        var host = hostAndRest.split(':')[0].split('/')[0];
        var terms = [
          'redirect_uri='+encodeURIComponent(redirectUri),
          'scope='+encodeURIComponent(scopesStr),
          'response_type=token',
          'client_id='+encodeURIComponent(host)
        ];
        var authHref = storageInfo.properties['auth-endpoint'];
        return authHref + (authHref.indexOf('?') === -1?'?':'&') + terms.join('&');
      },
      getDriver = function (type, cb) {
        if(type === 'https://www.w3.org/community/rww/wiki/read-write-web-00#couchdb'
          || type === 'https://www.w3.org/community/unhosted/wiki/remotestorage-2011.10#couchdb') {
          cb(couch);
        } else if(type === 'https://www.w3.org/community/rww/wiki/read-write-web-00#webdav'
          || type === 'https://www.w3.org/community/unhosted/wiki/remotestorage-2011.10#webdav') {
          cb(dav);
        } else {
          cb(simple);
        }
      },
      resolveKey = function(storageInfo, basePath, relPath, nodirs) {
        var itemPathParts = ((basePath.length?(basePath + '/'):'') + relPath).split('/');
        var item = itemPathParts.splice(1).join(nodirs ? '_' : '/');
        return storageInfo.href + '/' + itemPathParts[0]
          + (storageInfo.properties.legacySuffix ? storageInfo.properties.legacySuffix : '')
          + '/' + (item[0] == '_' ? 'u' : '') + item;
      },
      createClient = function (storageInfo, basePath, token) {
        return {
          get: function (key, cb) {
            if(typeof(key) != 'string') {
              cb('argument "key" should be a string');
            } else {
              getDriver(storageInfo.type, function (d) {
                d.get(resolveKey(storageInfo, basePath, key, storageInfo.nodirs), token, cb);
              });
            }
          },
          put: function (key, value, cb) {
            if(typeof(key) != 'string') {
              cb('argument "key" should be a string');
            } else if(typeof(value) != 'string') {
              cb('argument "value" should be a string');
            } else {
              getDriver(storageInfo.type, function (d) {
                d.put(resolveKey(storageInfo, basePath, key, storageInfo.nodirs), value, token, cb);
              });
            }
          },
          'delete': function (key, cb) {
            if(typeof(key) != 'string') {
              cb('argument "key" should be a string');
            } else {
              getDriver(storageInfo.type, function (d) {
                d['delete'](resolveKey(storageInfo, basePath, key, storageInfo.nodirs), token, cb);
              });
            }
          }
        };
      };

  return {
    getStorageInfo     : getStorageInfo,
    createStorageInfo  : createStorageInfo,
    createOAuthAddress : createOAuthAddress,
    createClient       : createClient,
    receiveToken       : widget.receiveToken,
    displayWidget      : widget.display
  };
});
