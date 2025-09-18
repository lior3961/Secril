export default function handler(req, res) {
  res.status(200).json({ 
    message: 'Root level API test working!',
    timestamp: new Date().toISOString()
  });
}
