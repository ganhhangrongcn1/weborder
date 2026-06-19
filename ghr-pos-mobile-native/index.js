/**
 * @format
 */

import {AppRegistry} from 'react-native';
import 'react-native-url-polyfill/auto';
import App from './App';
import {name as appName} from './app.json';
import {runPosPrintStationPoll} from './src/services/pos/posPrintStationService';

AppRegistry.registerComponent(appName, () => App);
AppRegistry.registerHeadlessTask('GhrPosPrintStationTask', () => async taskData => {
  await runPosPrintStationPoll({
    branchUuid: taskData?.branchUuid,
    deviceId: taskData?.deviceId
  });
});
