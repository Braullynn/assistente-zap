import React, { useState, useEffect, useRef } from 'react';
import api from './api';
import { User, Phone, LogIn, UserPlus, LogOut, Trash2, Sun, Moon, Send, RefreshCw } from 'lucide-react';

function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(!!localStorage.getItem('token'));
  const [isRegistering, setIsRegistering] = useState(false);
  const [theme, setTheme] = useState(localStorage.getItem('theme') || 'dark');
  const [users, setUsers] = useState([]);
  const [formData, setFormData] = useState({ nome: '', telefone: '', senha: '' });
  const [error, setError] = useState('');
  const [testMessage, setTestMessage] = useState('');
  const [chatMessages, setChatMessages] = useState([]);
  const chatEndRef = useRef(null);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
  }, [theme]);

  useEffect(() => {
    if (isLoggedIn) {
      fetchUsers();
      fetchHistory();
    }
  }, [isLoggedIn]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  const fetchUsers = async () => {
    try {
      const response = await api.get('/users');
      setUsers(response.data);
    } catch (err) {
      console.error('Erro ao buscar usuários', err);
    }
  };

  const fetchHistory = async () => {
    try {
      const response = await api.get('/ai/history');
      setChatMessages(response.data);
    } catch (err) {
      console.error('Erro ao buscar histórico', err);
    }
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    try {
      const response = await api.post('/auth/login', {
        telefone: formData.telefone,
        senha: formData.senha
      });
      localStorage.setItem('token', response.data.token);
      setIsLoggedIn(true);
      setError('');
    } catch (err) {
      setError(err.response?.data?.error || 'Erro ao fazer login');
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    try {
      await api.post('/auth/register', formData);
      setIsRegistering(false);
      setError('');
      setFormData({ nome: '', telefone: '', senha: '' });
      alert('Usuário cadastrado!');
    } catch (err) {
      setError(err.response?.data?.error || 'Erro ao cadastrar');
    }
  };

  const handleDeleteUser = async (id) => {
    if (window.confirm('Deletar este usuário?')) {
      try {
        await api.delete(`/users/${id}`);
        fetchUsers();
      } catch (err) {
        alert('Erro ao deletar');
      }
    }
  };

  const handleTestChat = async (e) => {
    e.preventDefault();
    if (!testMessage.trim()) return;

    const userMsg = { role: 'user', text: testMessage };
    setChatMessages(prev => [...prev, userMsg]);
    const currentMsg = testMessage;
    setTestMessage('');

    try {
      const response = await api.post('/ai/test-chat', { message: currentMsg });
      setChatMessages(prev => [...prev, { role: 'laura', text: response.data.message }]);
    } catch (err) {
      setChatMessages(prev => [...prev, { role: 'laura', text: 'Erro ao processar.' }]);
    }
  };

  const handleClearHistory = async () => {
    if (window.confirm('Limpar memória da Laura?')) {
      try {
        await api.delete('/ai/history');
        setChatMessages([]);
      } catch (err) {
        alert('Erro ao limpar');
      }
    }
  };

  const toggleTheme = () => setTheme(theme === 'dark' ? 'light' : 'dark');

  if (!isLoggedIn) {
    return (
      <div className="container" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <div className="glass fade-in" style={{ padding: '3rem', width: '100%', maxWidth: '400px' }}>
          <h1 style={{ textAlign: 'center', marginBottom: '2rem' }}>Laura AI</h1>
          <form onSubmit={isRegistering ? handleRegister : handleLogin}>
            {isRegistering && (
              <div className="input-group">
                <label>Nome</label>
                <input type="text" value={formData.nome} onChange={(e) => setFormData({ ...formData, nome: e.target.value })} required />
              </div>
            )}
            <div className="input-group">
              <label>Telefone</label>
              <input type="text" placeholder="55119..." value={formData.telefone} onChange={(e) => setFormData({ ...formData, telefone: e.target.value })} required />
            </div>
            <div className="input-group">
              <label>Senha</label>
              <input type="password" value={formData.senha} onChange={(e) => setFormData({ ...formData, senha: e.target.value })} required />
            </div>
            {error && <p style={{ color: '#ef4444', marginBottom: '1rem' }}>{error}</p>}
            <button type="submit" className="btn btn-primary" style={{ width: '100%' }}>
              {isRegistering ? 'Criar Conta' : 'Entrar'}
            </button>
          </form>
          <button onClick={() => setIsRegistering(!isRegistering)} style={{ background: 'none', border: 'none', color: 'var(--primary)', marginTop: '1.5rem', width: '100%', cursor: 'pointer' }}>
            {isRegistering ? 'Já tenho conta' : 'Cadastre-se'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="container fade-in">
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '3rem' }}>
        <div>
          <h1 style={{ fontSize: '2.5rem' }}>Laura AI</h1>
          <p style={{ opacity: 0.7 }}>Gestão e Testes</p>
        </div>
        <div style={{ display: 'flex', gap: '1rem' }}>
          <button onClick={toggleTheme} className="glass" style={{ padding: '10px' }}>
            {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
          </button>
          <button onClick={() => { localStorage.removeItem('token'); setIsLoggedIn(false); }} className="btn glass">
            <LogOut size={20} />
          </button>
        </div>
      </header>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 350px', gap: '2rem' }}>
        <div className="glass" style={{ padding: '2rem' }}>
          <h2>Usuários Ativos</h2>
          <table>
            <thead>
              <tr><th>Nome</th><th>Telefone</th><th>Ações</th></tr>
            </thead>
            <tbody>
              {users.map(user => (
                <tr key={user.id}>
                  <td>{user.nome}</td>
                  <td>{user.telefone}</td>
                  <td>
                    <button onClick={() => handleDeleteUser(user.id)} style={{ color: '#ef4444', background: 'none', border: 'none' }}>
                      <Trash2 size={18} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="glass" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', height: '600px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h3>Chat de Teste</h3>
            <button onClick={handleClearHistory} title="Limpar Histórico" style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444' }}>
              <RefreshCw size={18} />
            </button>
          </div>
          <div style={{ flex: 1, overflowY: 'auto', marginBottom: '1rem', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {chatMessages.map((m, i) => (
              <div key={i} style={{
                alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start',
                background: m.role === 'user' ? 'var(--primary)' : 'var(--card)',
                color: m.role === 'user' ? 'white' : 'inherit',
                padding: '10px',
                borderRadius: '12px',
                maxWidth: '85%',
                fontSize: '0.85rem'
              }}>
                {m.text}
              </div>
            ))}
            <div ref={chatEndRef} />
          </div>
          <form onSubmit={handleTestChat} style={{ display: 'flex', gap: '8px' }}>
            <input type="text" placeholder="Fale com a Laura..." value={testMessage} onChange={(e) => setTestMessage(e.target.value)} style={{ padding: '10px' }} />
            <button type="submit" className="btn btn-primary" style={{ padding: '10px' }}>
              <Send size={18} />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

export default App;
