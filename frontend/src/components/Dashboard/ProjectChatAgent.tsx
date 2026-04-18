import React, { useState, useRef, useEffect } from 'react';
import { Fab, Paper, Typography, TextField, IconButton, Box, CircularProgress } from '@mui/material';
import { Chat, Close, Send } from '@mui/icons-material';
import ApiService from '../../services/api';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

export default function ProjectChatAgent({ 
  projectId, 
  projectSummaryData 
}: { 
  projectId: number, 
  projectSummaryData: any 
})  {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    { role: 'assistant', content: 'Hi! I am your Project AI Assistant. Ask me about your inspection progress!' }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<null | HTMLDivElement>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || !projectId) return;

    const userMsg: Message = { role: 'user', content: input };
    const currentHistory = [...messages];
    
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
      const response = await ApiService.sendChatMessage(
        projectId, 
        userMsg.content, 
        currentHistory,
        projectSummaryData 
      );
      
      // FIX: Extract the text whether it comes back as "message.content" or "reply"
      const aiText = response.message?.content || response.reply || "No response received.";
      
      setMessages(prev => [...prev, { role: 'assistant', content: aiText }]);
    } catch (error) {
      console.error("Chat API Error:", error);
      setMessages(prev => [...prev, { role: 'assistant', content: 'Sorry, I encountered an error connecting to the server.' }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {/* Floating Action Button */}
      <Fab 
        color="primary" 
        onClick={() => setIsOpen(!isOpen)}
        sx={{ position: 'fixed', bottom: 24, right: 24, zIndex: 1000 }}
      >
        {isOpen ? <Close /> : <Chat />}
      </Fab>

      {/* Chat Window */}
      {isOpen && (
        <Paper 
          elevation={6} 
          sx={{
            position: 'fixed', bottom: 90, right: 24, zIndex: 1000,
            width: 350, height: 500, display: 'flex', flexDirection: 'column',
            overflow: 'hidden', borderRadius: 2
          }}
        >
          {/* Header */}
          <Box sx={{ bgcolor: 'primary.main', color: 'white', p: 2 }}>
            <Typography variant="h6" fontSize="1rem">Project AI Assistant</Typography>
          </Box>

          {/* Messages Area */}
          <Box sx={{ flex: 1, overflowY: 'auto', p: 2, display: 'flex', flexDirection: 'column', gap: 1, bgcolor: '#f5f5f5' }}>
            {messages.map((msg, idx) => (
              <Box key={idx} sx={{ alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start', maxWidth: '80%' }}>
                <Paper sx={{ 
                  p: 1.5, 
                  bgcolor: msg.role === 'user' ? 'primary.light' : 'white',
                  color: msg.role === 'user' ? 'white' : 'text.primary',
                  borderRadius: 2
                }}>
                  <Typography variant="body2">{msg.content}</Typography>
                </Paper>
              </Box>
            ))}
            {loading && <CircularProgress size={20} sx={{ alignSelf: 'flex-start', ml: 1 }} />}
            <div ref={messagesEndRef} />
          </Box>

          {/* Input Area */}
          <Box sx={{ p: 1, bgcolor: 'white', borderTop: '1px solid #e0e0e0', display: 'flex', alignItems: 'center' }}>
            <TextField
              fullWidth size="small" variant="outlined"
              placeholder="Ask about this project..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSend()}
            />
            <IconButton color="primary" onClick={handleSend} disabled={loading || !input.trim()}>
              <Send />
            </IconButton>
          </Box>
        </Paper>
      )}
    </>
  );
}