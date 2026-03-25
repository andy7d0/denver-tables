import { lazy, Suspense, useState, createContext, useContext, useEffect } from 'react';
import { BrowserRouter as Router, Routes,Route, Link, useNavigate} from "react-router-dom"

import {setAuthToken, subscribe, broadcast, getLoggedState, logout, login} from 'azlib/common.mjs'
import {base64encode} from 'azlib/b64.mjs'

import ClientPage from './client/client.jsx'
import TrPage from './terapist/tr.jsx'

// eslint-disable-next-line no-unassigned-import
import './App.css';


function DefApp() {
  const uinfo = useUinfo()
  const navigate = useNavigate()
  return (
    <div className="App">
      <h1>Страничка!</h1>
      <Link to="/tr">{uinfo.login}</Link> 
      {uinfo.login && <button onClick={()=>{logout(navigate)}}>logout</button>}
      {!uinfo.login &&
        <Link to="login">login</Link>}
      <div className="card">
        <p>
          <Link to="cl/001">client-page</Link>
        </p>
      </div>

    </div>
  );
}

function App() {
  return (
    <Router>
    <Routes>
      <Route path="*" element={<UinfoContext><UserApp /></UinfoContext>}/>
    </Routes>
   </Router>
  );

}

function UserApp() {
  return <Routes>
    <Route path="/" element={<DefApp/>} />
    <Route path="/login" element={<LoginPage/>} />
    <Route path="/cl/:b?" element={<ClientPage/>} />
    <Route path="/tr/*" element={<TrPage/>} />
  </Routes>
}

function LoginPage() {
  const [err, setErr] = useState()
  const navigate = useNavigate()
  return <div style={{position:"fixed", left:"50%", top:"50%", transform:"translate(-50%,-50%)"}}>
    <form onSubmit={async (event)=> {
      event.preventDefault();
      setErr(null)
      const data = new FormData(event.target);
      const obj = Object.fromEntries(data.entries())
      try {
        const uinfo = base64encode(JSON.stringify({login: data.get('login')}))
        await setAuthToken({
          authorization: `Bearer: ${uinfo}:-`, 
          pass: data.get('pass')
        });
        navigate('/tr')
      } catch(error) {
          console.log(error)
          if(typeof error === 'string') setErr(error)        
      }
    }} >
    Login: <input name="login" />
    <br/>
    Pass: <input name="pass" type="password" />
    <br/>
    <button>OK</button>
    {err}
    </form>
  </div>
}

const Uctx = createContext({})

const empty = {}

function UinfoContext({children}) {
  const [auth, setAuth] = useState()
  useEffect(()=>{
    const prev = subscribe('auth', setAuth)
    return () => subscribe('auth', prev)
  },[setAuth])
  useEffect(()=>{
    getLoggedState().then(st=>{broadcast('auth', st)})
  }, [])
  return <Uctx value={auth?.uinfo??empty}>{children}</Uctx>
}

export function useUinfo() {
  return useContext(Uctx);
}

export default App;
