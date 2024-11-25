/********************************************************
 * 
 * Macro Author:      	William Mills
 *                    	Technical Solutions Specialist 
 *                    	wimills@cisco.com
 *                    	Cisco Systems
 * 
 * Version: 1-5-0
 * Released: 11/25/24
 * 
 * This is an example macro for controlling Sony Cameras via
 * CGI HTTP Commands
 *
 * Full Readme, source code and license agreement available on Github:
 * https://github.com/wxsd-sales/sony-camera-control-macro
 * 
 ********************************************************/

import xapi from 'xapi';


/*********************************************************
 * Configure the settings below
**********************************************************/

const config = {
  camera: {
    ip: '169.254.1.30',
    username: 'admin',
    password: ''
  },
  button: {
    name: 'Sony Camera Control',
    icon: 'Camera',
    color: '#7c8285',
    location: 'ControlPanel'
  },
  panelRows: [
    {
      name: 'PtzAutoFraming',
      parameter: 'PtzAutoFraming',
      cgi: {
        Set: 'analytics/ptzautoframing.cgi',
        Inq: 'command/inquiry.cgi'
      },
      values: [
        {
          name: 'On',
          value: 'on'
        },
        {
          name: 'Off',
          value: 'off'
        }
      ]
    },
    {
      name: 'PtzAutoFramingAutoStartEnable',      // Row Name
      parameter: 'PtzAutoFramingAutoStartEnable', // CGI Command Parameter
      cgi: {
        Set: 'analytics/ptzautoframing.cgi',      // CGI Command Settings (Set) Path
        Inq: 'command/inquiry.cgi'                // CGI Command Inquiry (Inq) Path
      },
      values: [                                   // Array of CGI Command Paramter Names and Values
        {
          name: 'On',                             // Text which will be displayed on the UI Extension 
          value: 'on'                             // CGI Command Parameter value
        },
        {
        name: 'Off',                              // Text which will be displayed on the UI Extension 
          value: 'off'                            // CGI Command Parameter value
        }
      ]
    },
    {
      name: 'HdmiColor',
      parameter: 'HdmiColor',
      cgi: {
        Set: 'command/project.cgi',
        Inq: 'command/inquiry.cgi'
      },
      values: [
        {
          name: 'ycbcr',
          value: 'ycbcr'
        },
        {
          name: 'rgb',
          value: 'rgb'
        }
      ]
    }
  ],
  panelId: 'sonyControls'
}

/*********************************************************
 * Main functions and event subscriptions
**********************************************************/

init();
async function init() {
  // Enable HTTP Client
  xapi.Config.HttpClient.Mode.set('On');
  // Create UI Extension Panel with Widgets
  await createPanel();
  // Query the cameras parameters and update widgets
  await syncUI();
}

// Listen for Widget Presses and send Camera Set Parameter Commands
xapi.Event.UserInterface.Extensions.Widget.Action.on(event => {
  if (event.Type != 'pressed') return
  if (!event.WidgetId.startsWith(config.panelId)) return

  // Get index of pressed widget
  const [_panelId, index] = event.WidgetId.split('-');

  // Look up parameter row
  const row = config.panelRows[index];
  if (!row) return

  // Set Paramter on Camera
  console.log('Parameter:', row.parameter, ' Value:', event.Value);
  setParameter(row.cgi.Set, row.parameter, event.Value);
});


/**
 * Queries Camera for each configured parameter and update the
 * UI Extension Widget Groups to the current value
 */
async function syncUI() {
  console.log('Querying Camera Parameters and Syncing with UI');
  const panelId = config.panelId;
  const rows = config.panelRows;

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]
    // Query Camera Parameter
    const result = await getParameter(row.cgi.Inq, row.parameter)

    // Update or reset the Widget Group Value
    if (result) {
      console.log(`Setting WidgetId: ${`${panelId}-${i}`} - Value: ${result}`);
      xapi.Command.UserInterface.Extensions.Widget.SetValue({ Value: result, WidgetId: `${panelId}-${i}` })
        .catch(error => console.debug(`Could not set value for WidgetId: ${`${panelId}-${i}`} - ${error}`))
    } else {
      console.log(`Unsetting WidgetId: ${`${panelId}-${i}`}`);
      xapi.Command.UserInterface.Extensions.Widget.UnsetValue({ WidgetId: `${panelId}-${i}` })
        .catch(error => console.debug(`Could not unset value for WidgetId: ${`${panelId}-${i}`} - ${error}`))
    }
  }
}


/**
 * Sets the value of the provided parameter on the Sony Camera
 * @param {string} cgi - The CGI command string in which to set against 
 * @param {string} parameter - The CGI parameter which needs to be set 
 * @param {string} value - The value the CGI parameter should be set to
 * @returns {Promise}
 */
async function setParameter(cgi, parameter, value) {
  console.log('Setting Parameter:', parameter, 'to value:', value)

  const referer = `Referer: http://${config.camera.ip}`
  const result = await digestRequest({
    method: 'GET',
    headers: [referer],
    url: `http://${config.camera.ip}`,
    parameters: cgi + '?' + parameter + '=' + value,
    auth: { username: config.camera.username, password: config.camera.password, type: 'digest' }
  })

  console.debug('Set Parameter:', parameter, '- Result:', result);
}

/**
 * Queries and returns the values of the provided parameter from the Sony Camera
 * @param {string} cgi - The CGI command string in which to query against 
 * @param {string} parameter - Parameter strings in which to query
 * @returns {Promise<{object[]>|undefined}
 */
async function getParameter(cgi, parameter) {
  console.log('Getting parameters:', parameter, '- cgi:', cgi)

  const referer = `Referer: http://${config.camera.ip}`

  const result = await digestRequest({
    method: 'GET',
    headers: [referer],
    url: `http://${config.camera.ip}`,
    parameters: cgi + '?inq=' + parameter.trim(),
    auth: { username: config.camera.username, password: config.camera.password, type: 'digest' }
  })

  const statusCode = result?.StatusCode
  let body = result?.Body

  if (!statusCode) return
  console.debug('Raw Body', body, 'parameter', parameter)
  if (!body) return
  const parsedBody = parseResponse(body);
  console.debug('Parsed body', parsedBody)
  return parsedBody?.[parameter]

}


/**
 * This function parses the response body from the Sony Camera standard format response
 * @param {string} body - Raw response body string.
 * @returns [{object[]|undefined}]
 */
function parseResponse(body) {
  console.debug('Raw Body:', JSON.stringify(body))
  body = body.replace(/(\r\n|\n|\r)/gm, "");
  const rawParameters = body.split('&');
  console.debug('rawParameters :', JSON.stringify(rawParameters), ' length:', rawParameters.length)
  if (rawParameters.length == 0) return
  let parsed = {}
  for (let i = 0; i < rawParameters.length; i++) {
    const [parameter, value] = rawParameters[i].split('=');
    if (parameter && value) parsed[parameter] = value

  }

  console.debug('parsed:', JSON.stringify(parsed))
  return parsed
}


/**
 * Makes HTTP Request with additional support for HTTP Digest Auth and auto Retry
 */
async function digestRequest({ method, headers, url, parameters, data, auth, digest, timeout = 5 }) {
  if (!url || url == '') return

  method = method ?? 'GET';
  headers = headers ?? [];
  parameters = parameters ?? '';

  if (digest) headers.push('Authorization: ' + digest)

  const Url = url + (parameters != '' && !parameters.startsWith('/') ? '/' + parameters : parameters);

  console.debug(`HTTP ${method} Request - Url: ${Url} - Headers: ${headers}`, data ? `- Data: ${data}` : '');
  const result = await xapi.Command.HttpClient[method]({ Header: headers, ResultBody: 'PlainText', Url, Timeout: timeout }, data).catch(errorResult => errorResult)
  console.debug('HTTP Response:', result);

  const statusCode = result?.data?.StatusCode;
  const responseHeaders = result?.data?.Headers;

  if (!statusCode) return result

  // Return OK Responses
  if (parseInt(statusCode) >= 200 && parseInt(statusCode) < 300) return result

  // Only perform additional proccessing on 401 responses
  if (statusCode != 401) return result

  // Find www-authentication hearder if present in response
  const wwwAuth = responseHeaders.find(header => header.Key == 'www-authenticate')?.Value

  // If 401 with www-authentication hearder return raw response 
  if (!wwwAuth) return result

  // Check if response from server indicates stale authentication
  const stale = wwwAuth?.stale ? wwwAuth?.stale.toUpperCase() == 'TRUE' : false;

  // If auth is type digest, where a digest was given and response isn't stale. Consider it failed and return result
  if (auth?.type == 'digest' && digest && !stale) return result

  // Parse the www-authentication hearder
  const parsedWwwAuth = parseWwwAuth(wwwAuth)

  console.debug('wwwAuth:', wwwAuth, 'auth:', auth)

  // Generate a URL from previous request
  const uri = getURIFromURL(url);

  // Create Digest Header from www-authentication, auth, uri, and HTTP Method
  const newDigest = createHttpDigestHeader({ ...parsedWwwAuth, ...auth, uri, method, timeout })

  return await request({ method, headers, url, parameters, auth, digest: newDigest })

}


/**
 * Parses raw www-authentication Header string and returns object of its properties
 */
function parseWwwAuth(wwwAuth) {
  if (!wwwAuth.startsWith('Digest')) return
  const digestString = wwwAuth.replace('Digest ', '')
  const digestArray = digestString.split(', ')

  const result = {}
  digestArray.forEach(paramString => {
    const matches = paramString.match(/(\w+)="?([^"]*)"?/);
    if (matches && matches.length === 3) {
      const key = matches[1];
      const value = matches[2];
      result[key] = value;
    }
  })

  return result
}


/**
 * Generate MD5 Hash from provided string
 */
function md5(string) {
  function cmn(q, a, b, x, s, t) {
    a = add32(a, add32(add32(q, x), t));
    return add32((a << s) | (a >>> (32 - s)), b);
  }

  function ff(a, b, c, d, x, s, t) {
    return cmn((b & c) | ((~b) & d), a, b, x, s, t);
  }

  function gg(a, b, c, d, x, s, t) {
    return cmn((b & d) | (c & (~d)), a, b, x, s, t);
  }

  function hh(a, b, c, d, x, s, t) {
    return cmn(b ^ c ^ d, a, b, x, s, t);
  }

  function ii(a, b, c, d, x, s, t) {
    return cmn(c ^ (b | (~d)), a, b, x, s, t);
  }

  function md5cycle(x, k) {
    var a = x[0], b = x[1], c = x[2], d = x[3];

    a = ff(a, b, c, d, k[0], 7, -680876936);
    d = ff(d, a, b, c, k[1], 12, -389564586);
    c = ff(c, d, a, b, k[2], 17, 606105819);
    b = ff(b, c, d, a, k[3], 22, -1044525330);
    a = ff(a, b, c, d, k[4], 7, -176418897);
    d = ff(d, a, b, c, k[5], 12, 1200080426);
    c = ff(c, d, a, b, k[6], 17, -1473231341);
    b = ff(b, c, d, a, k[7], 22, -45705983);
    a = ff(a, b, c, d, k[8], 7, 1770035416);
    d = ff(d, a, b, c, k[9], 12, -1958414417);
    c = ff(c, d, a, b, k[10], 17, -42063);
    b = ff(b, c, d, a, k[11], 22, -1990404162);
    a = ff(a, b, c, d, k[12], 7, 1804603682);
    d = ff(d, a, b, c, k[13], 12, -40341101);
    c = ff(c, d, a, b, k[14], 17, -1502002290);
    b = ff(b, c, d, a, k[15], 22, 1236535329);

    a = gg(a, b, c, d, k[1], 5, -165796510);
    d = gg(d, a, b, c, k[6], 9, -1069501632);
    c = gg(c, d, a, b, k[11], 14, 643717713);
    b = gg(b, c, d, a, k[0], 20, -373897302);
    a = gg(a, b, c, d, k[5], 5, -701558691);
    d = gg(d, a, b, c, k[10], 9, 38016083);
    c = gg(c, d, a, b, k[15], 14, -660478335);
    b = gg(b, c, d, a, k[4], 20, -405537848);
    a = gg(a, b, c, d, k[9], 5, 568446438);
    d = gg(d, a, b, c, k[14], 9, -1019803690);
    c = gg(c, d, a, b, k[3], 14, -187363961);
    b = gg(b, c, d, a, k[8], 20, 1163531501);
    a = gg(a, b, c, d, k[13], 5, -1444681467);
    d = gg(d, a, b, c, k[2], 9, -51403784);
    c = gg(c, d, a, b, k[7], 14, 1735328473);
    b = gg(b, c, d, a, k[12], 20, -1926607734);

    a = hh(a, b, c, d, k[5], 4, -378558);
    d = hh(d, a, b, c, k[8], 11, -2022574463);
    c = hh(c, d, a, b, k[11], 16, 1839030562);
    b = hh(b, c, d, a, k[14], 23, -35309556);
    a = hh(a, b, c, d, k[1], 4, -1530992060);
    d = hh(d, a, b, c, k[4], 11, 1272893353);
    c = hh(c, d, a, b, k[7], 16, -155497632);
    b = hh(b, c, d, a, k[10], 23, -1094730640);
    a = hh(a, b, c, d, k[13], 4, 681279174);
    d = hh(d, a, b, c, k[0], 11, -358537222);
    c = hh(c, d, a, b, k[3], 16, -722521979);
    b = hh(b, c, d, a, k[6], 23, 76029189);
    a = hh(a, b, c, d, k[9], 4, -640364487);
    d = hh(d, a, b, c, k[12], 11, -421815835);
    c = hh(c, d, a, b, k[15], 16, 530742520);
    b = hh(b, c, d, a, k[2], 23, -995338651);

    a = ii(a, b, c, d, k[0], 6, -198630844);
    d = ii(d, a, b, c, k[7], 10, 1126891415);
    c = ii(c, d, a, b, k[14], 15, -1416354905);
    b = ii(b, c, d, a, k[5], 21, -57434055);
    a = ii(a, b, c, d, k[12], 6, 1700485571);
    d = ii(d, a, b, c, k[3], 10, -1894986606);
    c = ii(c, d, a, b, k[10], 15, -1051523);
    b = ii(b, c, d, a, k[1], 21, -2054922799);
    a = ii(a, b, c, d, k[8], 6, 1873313359);
    d = ii(d, a, b, c, k[15], 10, -30611744);
    c = ii(c, d, a, b, k[6], 15, -1560198380);
    b = ii(b, c, d, a, k[13], 21, 1309151649);
    a = ii(a, b, c, d, k[4], 6, -145523070);
    d = ii(d, a, b, c, k[11], 10, -1120210379);
    c = ii(c, d, a, b, k[2], 15, 718787259);
    b = ii(b, c, d, a, k[9], 21, -343485551);

    x[0] = add32(a, x[0]);
    x[1] = add32(b, x[1]);
    x[2] = add32(c, x[2]);
    x[3] = add32(d, x[3]);
  }

  function md5blk(s) {
    var md5blks = [], i;
    for (i = 0; i < 64; i += 4) {
      md5blks[i >> 2] = s.charCodeAt(i)
        + (s.charCodeAt(i + 1) << 8)
        + (s.charCodeAt(i + 2) << 16)
        + (s.charCodeAt(i + 3) << 24);
    }
    return md5blks;
  }

  function md51(s) {
    var n = s.length,
      state = [1732584193, -271733879, -1732584194, 271733878],
      i;
    for (i = 64; i <= n; i += 64) {
      md5cycle(state, md5blk(s.substring(i - 64, i)));
    }
    s = s.substring(i - 64);
    var tail = new Array(16).fill(0);
    for (i = 0; i < s.length; i++) {
      tail[i >> 2] |= s.charCodeAt(i) << ((i % 4) << 3);
    }
    tail[i >> 2] |= 0x80 << ((i % 4) << 3);
    if (i > 55) {
      md5cycle(state, tail);
      tail.fill(0);
    }
    tail[14] = n * 8;
    md5cycle(state, tail);
    return state;
  }

  function rhex(n) {
    var s = '', j;
    for (j = 0; j < 4; j++) {
      s += ((n >> (j * 8 + 4)) & 0x0F).toString(16) + ((n >> (j * 8)) & 0x0F).toString(16);
    }
    return s;
  }

  function hex(x) {
    return x.map(rhex).join('');
  }

  function add32(a, b) {
    return (a + b) & 0xFFFFFFFF;
  }

  return hex(md51(string));
}

/**
 * Get URI From URL
 */
function getURIFromURL(url) {
  // Regular expression to parse URL components
  const urlPattern = /^(?:https?:\/\/)?[^\/]+(\/[^?#]*)?(\?[^#]*)?(#.*)?$/i;
  const match = url.match(urlPattern);

  if (match) {
    const pathname = match[1] || ''; // Pathname component
    const search = match[2] || '';   // Search (query) component
    const hash = match[3] || '';     // Hash (fragment) component
    return pathname + search + hash;
  } else {
    console.error("Invalid URL");
    return null;
  }
}

/**
 * Create HTTP Digest Response Header
 */
function createHttpDigestHeader({ username, password, realm, method, uri, nonce, nc, cnonce, qop } = {}) {

  // Create HA1 hash
  const HA1 = md5(`${username}:${realm}:${password}`);

  // Create HA2 hash
  const HA2 = md5(`${method.toUpperCase()}:${uri}`);

  let digestHeader
  let response

  if (qop) {
    // If qop is provided, include it in the response
    nc = nc ?? '00000001';
    cnonce = cnonce ?? '0a4f113b';
    response = md5(`${HA1}:${nonce}:${nc}:${cnonce}:${qop}:${HA2}`);
    digestHeader = `Digest username="${username}", realm="${realm}", nonce="${nonce}", uri="${uri}", algorithm="MD5", response="${response}", qop=${qop}, nc=${nc}, cnonce="${cnonce}"`;
  } else {
    // If qop is not provided, exclude it from the response
    response = md5(`${HA1}:${nonce}:${HA2}`);
    digestHeader = `Digest username="${username}", realm="${realm}", nonce="${nonce}", uri="${uri}", algorithm="MD5", response="${response}"`;
  }
  return digestHeader;
}

function createGroup(widgetId, values) {
  const valuesSpaces = values.map(value => `<Value><Key>${value.value}</Key><Name>${value.name}</Name></Value>`)

  return `<Widget>
            <WidgetId>${widgetId}</WidgetId>
            <Type>GroupButton</Type>
            <Options>size=4;columns=2</Options>
            <ValueSpace>
            ${valuesSpaces}
            </ValueSpace>
          </Widget>`
}

/**
 * Saves UI Extension Panel
 */
async function createPanel() {

  const panelId = config.panelId;
  const button = config.button;
  const panelRows = config.panelRows;
  const order = await panelOrder(panelId);

  const rows = panelRows.map((row, index) => {
    return `<Row><Name>${row.name}</Name>${createGroup(`${panelId}-${index}`, row.values)}</Row>`
  })

  const panel = `
  <Extensions>
    <Panel>
      <Location>${button.location}</Location>
      <Icon>${button.icon}</Icon>
      ${order}
      <Name>${button.name}</Name>
      <ActivityType>Custom</ActivityType>
      <Page>
        <Name>${button.name}</Name>
        ${rows}
        <Options>hideRowNames=0</Options>
      </Page>
    </Panel>
  </Extensions>`;

  xapi.Command.UserInterface.Extensions.Panel.Save({ PanelId: panelId }, panel)
    .catch(e => console.log('Error saving panel: ' + e.message))
}


/*********************************************************
 * Gets the current Panel Order if exiting Macro panel is present
 * to preserve the order in relation to other custom UI Extensions
 **********************************************************/
async function panelOrder(panelId) {
  const list = await xapi.Command.UserInterface.Extensions.List({ ActivityType: "Custom" });
  const panels = list?.Extensions?.Panel
  if (!panels) return ''
  const existingPanel = panels.find(panel => panel.PanelId == panelId)
  if (!existingPanel) return ''
  return `<Order>${existingPanel.Order}</Order>`
}
