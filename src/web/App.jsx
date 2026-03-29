import { lazy, Suspense, useState, createContext, useContext, useEffect } from 'react';
import { BrowserRouter as Router, Routes,Route, Link, useNavigate} from "react-router-dom"

import ClientPage from './client/client.jsx'
import TrPage, {TrRegister} from './terapist/tr.jsx'

// eslint-disable-next-line no-unassigned-import
import './App.css';


function DefApp() {
  return (
    <div className="App">
      <h1>Маленикая програмка работы с ESDM тестированием</h1>
      <br/><br/><br/><br/>
      <center><Link to="/tr">Войти</Link></center>
    </div>
  );
}

function App() {
  return (
    <Router>
    <Routes>
      <Route path="/" element={<DefApp/>} />
      <Route path='/register/:link' element={<TrRegister/>} />
      <Route path="/cl/:b?" element={<ClientPage/>} />
      <Route path="/tr/*" element={<TrPage/>} />
    </Routes>
   </Router>
  );

}


export default App;
