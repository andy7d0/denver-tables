import { lazy, Suspense, useState, createContext, useContext, useEffect } from 'react';
import { BrowserRouter as Router, Routes,Route, Link, useNavigate} from "react-router-dom"

import {setAuthToken, subscribe, broadcast, getLoggedState, logout, login} from 'azlib/common.mjs'

import ClientPage from './client/client.jsx'

// eslint-disable-next-line no-unassigned-import
import './App.css';


function DefApp() {
  const uinfo = useUinfo()
  const navigate = useNavigate()
  return (
    <div className="App">
      <h1>Страничка!</h1>
      {uinfo.login}+{uinfo.tmp} {uinfo.login && <button onClick={()=>{logout(navigate)}}>logout</button>}
      {!uinfo.login &&
        <Link to="login">login</Link>}
      <div className="card">
        <p>
          <Link to="cl">client-page</Link>
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
    <Route path="/cl" element={<ClientPage/>} />
  </Routes>
}

function LoginPage() {
  const [err, setErr] = useState()
  const navigate = useNavigate()
  return <div>
    <form onSubmit={async (event)=> {
      event.preventDefault();
      setErr(null)
      const data = new FormData(event.target);
      const obj = Object.fromEntries(data.entries())
      try {
        const auth = null; //TODO: await login(()=>api_post('/app/login',obj))
        await setAuthToken(auth);
        navigate('/')
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
