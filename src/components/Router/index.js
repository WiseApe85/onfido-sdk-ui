import { h, Component } from 'preact'
import { bindActionCreators } from 'redux'
import { connect } from 'react-redux'
import io from 'socket.io-client'

import { componentsList } from './StepComponentMap'
import { unboundActions } from '../../core'
import StepsRouter from './StepsRouter'

const Router = (props) =>
    props.options.mobileFlow ?
      <MobileRouter {...props}/> : <DesktopRouter {...props}/>

//TODO, delete once we own the hosting
const queryParams = () => window.location.search.slice(1)
                    .split('&')
                    .reduce( (/*Object*/ a, /*String*/ b) => {
                      b = b.split('=');
                      a[b[0]] = decodeURIComponent(b[1]);
                      return a;
                    }, {});

class MobileRouter extends Component {

  constructor(props) {
    super(props)
    this.state = {
      token: null,
      steps: null,
      flow: 'captureSteps',
      socket: io(process.env.DESKTOP_SYNC_URL),
      //TODO, replace with this when we own the hosting:
      //roomId: window.location.pathname.substring(1),
      roomId: queryParams().roomId,
    }
    this.state.socket.on('config', this.setConfig(props.actions))
    this.state.socket.emit('join', {room: this.state.roomId})
    this.requestConfig()
  }

  requestConfig = () => {
    this.state.socket.emit('message', {room: this.state.roomId, event: 'get config'})
  }

  setConfig = (actions) => {
    return (data) => {
      const {token, steps, documentType, step} = data
      this.setState({token, steps, step})
      actions.setDocumentType(documentType)
    }
  }

  onStepChange = ({step, flow}) => {
    this.setState({step, flow})
  }

  buildComponentsList = () => {
    const params = {
      flow: this.state.flow,
      documentType: this.props.documentType,
      steps: this.props.options.steps
    }
    return componentsList(params)
  }

  render = (props) => {
    const components = this.buildComponentsList()
    return (
      this.state.token ?
        <StepsRouter {...props} {...this.state}
          componentsList={components}
          step={this.state.step}
          onStepChange={this.onStepChange}
          flow={this.state.flow}
          isMobileFlow={props.options.mobileFlow}
        /> : <p>LOADING</p>
    )
  }
}

class DesktopRouter extends Component {

  constructor(props) {
    super(props)
    this.state = {
      roomId: null,
      socket: io(process.env.DESKTOP_SYNC_URL),
      mobileConnected: false,
      flow: 'captureSteps',
      step: this.props.step || 0,
      mobileInitialStep: null
    }

    this.state.socket.on('joined', this.setRoomId)
    this.state.socket.on('get config', this.sendConfig)
    this.state.socket.emit('join', {})
  }

  setRoomId = (data) => {
    this.setState({roomId: data.roomId})
  }

  sendConfig = () => {
    const {documentType, options} = this.props
    const {steps, token} = options
    const config = {steps, token, documentType, step: this.state.mobileInitialStep}
    this.state.socket.emit('message', {room: this.state.roomId, event: 'config', payload: config})
    this.setState({mobileConnected: true})
  }

  nextFlow = () =>
    this.state.flow === 'captureSteps' ? 'crossDeviceSteps' : 'captureSteps'

  onStepChange = ({step, flow, mobileInitialStep}) => {
    this.setState({step, flow, mobileInitialStep})
  }

  buildComponentsList = () => {
    const params = {
      flow: this.state.flow,
      documentType: this.props.documentType,
      steps: this.props.options.steps
    }
    return componentsList(params)
  }

  render = (props) => {
    const components = this.buildComponentsList()
    return (
      <StepsRouter {...props}
        componentsList={components}
        flow={this.state.flow}
        nextFlow={this.nextFlow}
        step={this.state.step}
        onStepChange={this.onStepChange}
        roomId={this.state.roomId}
        isMobileFlow={props.options.mobileFlow}
      />
    )
  }
}

function mapStateToProps(state) {
  return {...state.globals}
}

function mapDispatchToProps(dispatch) {
  return { actions: bindActionCreators(unboundActions, dispatch) }
}

export default connect(mapStateToProps, mapDispatchToProps)(Router)
