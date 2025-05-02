export const setLaunchSequenceSuccess = {
  type: 'SET_LAUNCH_SEQUENCE',
  payload: [
    {
      label: 'Clear old files',
      status: 'success'
    },
    {
      label: 'Download appconfig',
      status: 'success'
    },
    {
      label: 'Download javascript bundle',
      status: 'success'
    },
    {
      label: 'Setup new files',
      status: 'success'
    }
  ]
}

export const setLaunchSequenceSetupFileError = {
  type: 'SET_LAUNCH_SEQUENCE',
  payload: [
    {
      label: 'Clear old files',
      status: 'success'
    },
    {
      label: 'Download appconfig',
      status: 'error'
    },
    {
      label: 'Download javascript bundle',
      status: 'error'
    },
    {
      label: 'Setup new files',
      status: 'error'
    }
  ]
}