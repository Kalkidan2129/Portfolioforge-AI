require('dotenv').config();
const express = require('express');
const session = require('express-session');
const passport = require('passport');
const GitHubStrategy = require('passport-github2').Strategy;
const app = express();

passport.use(new GitHubStrategy({
  clientID: process.env.GITHUB_CLIENT_ID,
  clientSecret: process.env.GITHUB_CLIENT_SECRET,
  callbackURL: 'http://localhost:3000/auth/github/callback'
}, (accessToken, refreshToken, profile, done) => {
  return done(null, { profile, accessToken });
}));

passport.serializeUser((user, done) => {
  done(null, user);
});

passport.deserializeUser((user, done) => {
  done(null, user);
});

app.use(express.json());
app.use(session({
  secret: 'mysecret',
  resave: false,
  saveUninitialized: false
}));
app.use(passport.initialize());
app.use(passport.session());
const PORT = process.env.PORT || 3000;
const items = [];
const userPortfolios = new Map();

app.get('/', (req, res) => {
  res.send('Server is running');
});

app.get('/api/test', (req, res) => {
  res.json(items);
});

app.post('/api/test', (req, res) => {
  if (!req.body || Object.keys(req.body).length === 0 || !req.body.name || req.body.name.trim() === '') {
    return res.status(400).json({ error: 'Invalid input' });
  }
  const newItem = {
    name: req.body.name,
    createdAt: new Date()
  };
  items.push(newItem);
  res.json(items);
});

app.get('/api/repos', async (req, res) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  const accessToken = req.user.accessToken;
  const response = await fetch('https://api.github.com/user/repos', {
    headers: {
      Authorization: `token ${accessToken}`
    }
  });
  const data = await response.json();
  const portfolioRepos = data.map(repo => ({
    title: repo.name,
    summary: repo.description || 'No description',
    link: repo.html_url,
    tech: repo.language,
    lastUpdated: repo.updated_at
  }));
  res.json(portfolioRepos);
});

app.post('/api/portfolio', (req, res) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  const userId = req.user.profile.id;
  userPortfolios.set(userId, req.body);
  res.json({ message: 'Portfolio saved' });
});

app.get('/api/portfolio', (req, res) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  const userId = req.user.profile.id;
  const portfolio = userPortfolios.get(userId);
  if (!portfolio) {
    return res.json({ message: 'No portfolio found' });
  }
  res.json(portfolio);
});

app.get('/api/portfolio/generate', (req, res) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  const userId = req.user.profile.id;
  const portfolio = userPortfolios.get(userId);
  if (!portfolio) {
    return res.json({ message: 'No portfolio found' });
  }
  const username = req.user.profile.username;
  const techSet = new Set();
  portfolio.forEach(project => {
    if (project.tech) {
      techSet.add(project.tech);
    }
  });
  const techSummary = Array.from(techSet);
  const portfolioSummary = `${username} has built ${portfolio.length} projects using ${techSummary.join(', ')}.`;
  res.json({
    owner: username,
    portfolioTitle: `${username}'s Portfolio`,
    projectCount: portfolio.length,
    projects: portfolio,
    techSummary,
    portfolioSummary
  });
});

app.get('/api/portfolio/save-from-github', async (req, res) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  const accessToken = req.user.accessToken;
  const response = await fetch('https://api.github.com/user/repos', {
    headers: {
      Authorization: `token ${accessToken}`
    }
  });
  const data = await response.json();
  const portfolioRepos = data.map(repo => ({
    title: repo.name,
    summary: repo.description || 'No description',
    link: repo.html_url,
    tech: repo.language,
    lastUpdated: repo.updated_at
  }));
  const userId = req.user.profile.id;
  userPortfolios.set(userId, portfolioRepos);
  res.json({ message: 'Portfolio saved', count: portfolioRepos.length });
});

app.get('/auth/github', passport.authenticate('github', { scope: ['user:email'] }));

app.get('/auth/github/callback', 
  passport.authenticate('github', { failureRedirect: '/' }),
  (req, res) => {
    res.send('Login successful');
  }
);

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
