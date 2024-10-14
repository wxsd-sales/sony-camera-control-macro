/********************************************************
 * 
 * Macro Author:      	William Mills
 *                    	Technical Solutions Specialist 
 *                    	wimills@cisco.com
 *                    	Cisco Systems
 * 
 * Version: 1-0-0
 * Released: 08/15/24
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
    ip: '<Cameras IP Address Password>',
    username: 'admin',
    password: '<Cameras Admin Password>'
  },
  button: {
    name: 'Sony Camera Control',
    icon: 'Camera',
    color: '#7c8285',
    location: 'ControlPanel'
  },
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
  await syncUI()
}

// Listen for Widget Presses and send Camera Set Parameter Commands
xapi.Event.UserInterface.Extensions.Widget.Action.on(event => {
  if (event.Type != 'pressed') return
  if (!event.WidgetId.startsWith(config.panelId)) return

  // extract cgi and parameter name from widget Id string
  const [_panelId, cgi, parameter] = event.WidgetId.split('-');
  console.log('Parameter:', parameter, ' Value:', event.Value);
  setParameter(cgi, parameter, event.Value);
});

/**
 * Identified configured Camera Widgets and queries the value
 * of the widgets from configured Sony Camera and updates the 
 * Widget UI Values
 */
async function syncUI() {
  console.log('Quering Camera Parameters and Syncing with UI');
  const panelId = config.panelId;
  const widgets = await xapi.Status.UserInterface.Extensions.Widget.get();
  const widgetParameters = widgets.filter(widget => widget.WidgetId.startsWith(panelId)).map(widget => {
    const [_panelId, cgi, parameter] = widget.WidgetId.split('-');
    return { cgi, parameter }
  });
  console.debug('Discovered Parameter Widgets:', widgetParameters);

  const ptzWidgets = widgetParameters.filter(parameter => parameter.cgi.startsWith('ptzautoframing'))
  const regularWidgets = widgetParameters.filter(parameter => !parameter.cgi.startsWith('ptzautoframing'))


  console.debug('Discovered PTZ Widgets:', JSON.stringify(ptzWidgets))
  console.debug('Discovered Regular Widgets:', JSON.stringify(regularWidgets))

  if (ptzWidgets.length > 0) {
    const parameters = ptzWidgets.map(value => value.parameter)
    const ptzValues = await getParameters(ptzWidgets?.[0].cgi, parameters) ?? [];
    console.debug('Camera Query PTZ Parameter Response Values:', ptzValues);

    ptzValues.forEach(response => {
      const widget = widgetParameters.find(widget => widget.parameter == response.parameter)
      const widgetId = `${panelId}-${widget.cgi}-${response.parameter}`;
      console.log('Setting Widget ID:', widgetId, 'to:', response.value)
      xapi.Command.UserInterface.Extensions.Widget.SetValue({ Value: response.value, WidgetId: widgetId })
      .catch(error=>console.debug(`Could not set value for WidgetId[${widgetId}] - ${error}`))
    })
  }

  if (regularWidgets.length > 0) {
    const parameters = regularWidgets.map(value => value.parameter)
    const regularValues = await getParameters(regularWidgets?.[0].cgi, parameters)  ?? [];
    console.debug('Camera Query Regular Parameter Response Values:', regularValues);

    regularValues.forEach(response => {
      const widget = widgetParameters.find(widget => widget.parameter == response.parameter)
      const widgetId = `${panelId}-${widget.cgi}-${response.parameter}`;
      console.log('Setting Widget ID:', widgetId, 'to:', response.value)
      xapi.Command.UserInterface.Extensions.Widget.SetValue({ Value: response.value, WidgetId: widgetId })
      .catch(error=>console.debug(`Could not set value for WidgetId[${widgetId}] - ${error}`))
    })
  }

}


/**
 * Sets the value of the provided parameter on the Sony Camera
 * @param {string} cgi - The CGI command string in which to set against 
 * @param {string} parameter - The CGI parameter which needs to be set 
 * @param {string} value - The value the CGI parameter should be set to
 * @returns {Promise}
 */
function setParameter(cgi, parameter, value) {
  console.log('Setting Parameter:', parameter, 'to value:', value)
  return cameraAPI('Set', cgi, { [parameter]: value })
}

/**
 * Queries and returns the values of the provided parameters from the Sony Camera
 * @param {string} cgi - The CGI command string in which to query against 
 * @param {string[]} parameters - Array of parameter strings in which to query
 * @returns {Promise<{object[]>|undefined}
 */
function getParameters(cgi, parameters) {
  console.log('Getting parameters:', parameters, '- cgi:', cgi)
  return cameraAPI('Inq', cgi, null, parameters)
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
  const parsed = rawParameters.map(rawpParameter => {
    const [parameter, value] = rawpParameter.split('=');
    if (!parameter || !value) return
    return { parameter, value }
  })
  console.debug('parsed:', JSON.stringify(parsed))
  return parsed
}


/**
 * This function makes API requests to the Sony Camera via CGI
 * parameter {string} type - 'Set' or 'Inq'
 */
async function cameraAPI(type, cgi, setParameters = [], inqParameters = []) {

  const camera = config.camera;
  const path = (cgi.startsWith('ptzautoframing')) ? 'analytics' : 'command';
  const base = `http://${camera.ip}/${path}/`;

  const query = (type == 'Set') ? Object.keys(setParameters).map(key => `${key}=${setParameters[key]}`).join('&') :
    inqParameters.map(parameter => `inq=${parameter}`).join('&');

  const Url = `${base}${cgi}?${query}`
  const auth = btoa(`${config.camera.username}:${config.camera.password}`);
  const Header = ['accept: text/plain', 'authorization: Basic ' + auth];

  console.debug('Camera API Request - Type:', type, '- Url:', Url)
  console.debug('Camera API Headers:', Header)


  if (type == 'Set') {
    return xapi.Command.HttpClient.POST({ Header, ResultBody: 'PlainText', Url, Timeout: 5 }, '')
      .then(result => console.debug('Set Response', result))
      .catch(error => { 
        console.log(error); 

        xapi.Command.UserInterface.Message.Alert.Display({ 
          Duration: 10, 
          Title: `Error Setting Values On Camera IP: ${camera.ip}`, 
          Text: `${query.split('&').join('<br>')}<br>Error Message:<br>${error.message}`
        });

         })
  } else if (type == 'Inq') {
    return xapi.Command.HttpClient.GET({ AllowInsecureHTTPS: 'True', Header, ResultBody: 'PlainText', Url, Timeout: 5 })
      .then(result => parseResponse(result.Body))
      .catch(error => {
        console.log(error);
      })
  }

}

/**
 * Saves UI Extension Panel
 */
async function createPanel() {

  const panelId = config.panelId;
  const button = config.button;
  const order = await panelOrder(panelId);

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
        <Row>
          <Name>PtzAutoFraming</Name>
          <Widget>
            <WidgetId>${panelId}-ptzautoframing.cgi-PtzAutoFraming</WidgetId>
            <Type>GroupButton</Type>
            <Options>size=4;columns=2</Options>
            <ValueSpace>
            <Value><Key>on</Key><Name>On</Name></Value>
            <Value><Key>off</Key><Name>Off</Name></Value>
            </ValueSpace>
          </Widget>
        </Row>
        <Row>
          <Name>PtzAutoFramingAutoStartEnable</Name>
          <Widget>
            <WidgetId>${panelId}-ptzautoframing.cgi-PtzAutoFramingAutoStartEnable</WidgetId>
            <Type>GroupButton</Type>
            <Options>size=4;columns=2</Options>
            <ValueSpace>
            <Value><Key>on</Key><Name>On</Name></Value>
            <Value><Key>off</Key><Name>Off</Name></Value>
            </ValueSpace>
          </Widget>
        </Row>
        <Row>
          <Name>HdmiColor</Name>
          <Widget>
            <WidgetId>${panelId}-project.cgi-HdmiColor</WidgetId>
            <Type>GroupButton</Type>
            <Options>size=4;columns=2</Options>
            <ValueSpace>
            <Value><Key>ycbcr</Key><Name>YCbCr</Name></Value>
            <Value><Key>rgb</Key><Name>RGB</Name></Value>
            </ValueSpace>
          </Widget>
        </Row>
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
