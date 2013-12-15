var c14n = require("xml-c14n")(),
    request = require("request"),
    xacml = require("xacml"),
    xmldom = require("xmldom"),
    xmlentities = require("xml-entities"),
    xpath = require("xpath");

var WSO2ExecutionStrategy = module.exports = function WSO2ExecutionStrategy(options) {
  options = options || {};

  xacml.ExecutionStrategy.call(this, options);

  this._url = options.url;
  this._username = options.username;
  this._password = options.password;

  this._canonicaliser = c14n.createCanonicaliser("http://www.w3.org/2001/10/xml-exc-c14n#");
};
WSO2ExecutionStrategy.prototype = Object.create(xacml.ExecutionStrategy.prototype, {constructor: {value: WSO2ExecutionStrategy}});

WSO2ExecutionStrategy.prototype.executeRequest = function executeRequest(req, cb) {
  var document = new xmldom.DOMImplementation().createDocument("http://org.apache.axis2/xsd", "wrapper");

  var rootElement = document.documentElement,
      requestElement = document.createElementNS("http://org.apache.axis2/xsd", "request");

  rootElement.setAttribute("xmlns", "http://org.apache.axis2/xsd");

  rootElement.appendChild(requestElement);

  var self = this;

  if (req.toDocument) {
    req = req.toDocument();
  }

  return this._canonicaliser.canonicalise(req, function(err, xml) {
    if (err) {
      return cb(err);
    }

    requestElement.appendChild(document.createTextNode(xml));

    console.log(xml);

    return self._canonicaliser.canonicalise(rootElement, function(err, xml) {
      if (err) {
        return cb(err);
      }

      var options = {
        uri: self._url,
        headers: {
          "content-type": "application/xml",
        },
        auth: {
          user: self._username,
          pass: self._password,
          sendImmediately: true,
        },
        body: xml,
        rejectUnauthorized: false,
      };

      return request.post(options, function(err, res, data) {
        if (err) {
          return cb(err);
        }

        var parser = new xmldom.DOMParser();

        try {
          var wrapper = parser.parseFromString(data);
          var content = xmlentities.decode(xpath.select("./*/*[namespace-uri()='http://org.apache.axis2/xsd' and local-name()='return']/text()", wrapper).toString());
          content = content.replace(/^<([a-zA-Z0-9-]+)/, '<$1 xmlns="urn:oasis:names:tc:xacml:3.0:core:schema:wd-17"');
          var payload = parser.parseFromString(content);
          var parsed = xacml.Protocol.fromDocument(payload);
        } catch (e) {
          return cb(e);
        }

        console.log(content);

        return cb(null, parsed, payload);
      });
    });
  });
};
