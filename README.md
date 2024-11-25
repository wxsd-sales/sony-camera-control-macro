# Sony Camera Control Macro

This is an example macro which lets you control a Sony camera via CGI HTTP Commands using a UI Extension panel on a RoomOS Device.


## Overview

This macro communicates with Sony cameras that commands set via CGI and has support for the following features;

* Command to Auto UI Extension Generation:

    This builds its UI Extension panel controls based on the CGI Commands and Parameter you want it to control. Simply define the CGI Command Parameters, Set/Inq Paths and Values and the macro will generate the UI Extension itself.
    ```javascript
    {
      name: 'PtzAutoFramingAutoStartEnable',      // Row Name
      parameter: 'PtzAutoFramingAutoStartEnable', // CGI Command Parameter
      cgi: {
        Set: 'analytics/ptzautoframing.cgi',      // CGI Command Settings (Set) Path
        Inq: 'command/inquiry.cgi'                // CGI Command Inquiry (Inq) Path
      },
      values: [                                   // Array of CGI Command Parameter Names and Values
        {
          name: 'On',                             // Text which will be displayed on the UI Extension 
          value: 'on'                             // CGI Command Parameter value
        },
        {
        name: 'Off',                              // Text which will be displayed on the UI Extension 
          value: 'off'                            // CGI Command Parameter value
        }
      ]
    }
    ```
* UI State Synchronization:

    When the macro first starts, it will query the Cameras settings based on the configured CGI Commands and Parameters and will update the UI Extension Values.
    
* HTTP Digest Authentication:

    CGI HTTP Commands on Sony cameras require HTTP Digest for Authentication. This macro features a custom HTTP Digest Authentication wrapped around the HTTP Client xAPI commands. 
    
    Warning: This implementation hasn't been fully tested and isn't guaranteed to work without issue.



## Setup

### Prerequisites & Dependencies: 

- Codec EQ or Codec Pro with RoomOS 11.x or above
- Web admin access to the device to upload the macro
- Sony Camera (SRG-A40) to control


### Installation Steps:

1. Download the ``sony-camera-controls.js`` file and upload it to your Webex Devices Macro editor via the web interface.
2. Configure the macro layouts config array by adding or removing the layouts you require.
3. Enable the Macro on the editor.
    
    
## Demo

*For more demos & PoCs like this, check out our [Webex Labs site](https://collabtoolbox.cisco.com/webex-labs).


## License

All contents are licensed under the MIT license. Please see [license](LICENSE) for details.


## Disclaimer

Everything included is for demo and Proof of Concept purposes only. Use of the site is solely at your own risk. This site may contain links to third party content, which we do not warrant, endorse, or assume liability for. These demos are for Cisco Webex use cases, but are not Official Cisco Webex Branded demos.


## Questions
Please contact the WXSD team at [wxsd@external.cisco.com](mailto:wxsd@external.cisco.com?subject=sony-camera-control-macro) for questions. Or, if you're a Cisco internal employee, reach out to us on the Webex App via our bot (globalexpert@webex.bot). In the "Engagement Type" field, choose the "API/SDK Proof of Concept Integration Development" option to make sure you reach our team. 
