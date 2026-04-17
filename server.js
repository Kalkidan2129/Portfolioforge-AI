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

app.get('/api/portfolio/generate-narrative', (req, res) => {
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
  const narrativePrompt = `Write a professional portfolio summary for ${username} who has built ${portfolio.length} projects using ${techSummary.join(', ')}.`;
  const generatedNarrative = `${username} is a developer who has built ${portfolio.length} projects using ${techSummary.join(', ')}. Their portfolio highlights practical experience and technical growth.`;
  res.json({
    owner: username,
    projectCount: portfolio.length,
    techSummary,
    narrativePrompt,
    generatedNarrative
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

app.get('/portfolio/view', (req, res) => {
  if (!req.user) {
    return res.status(401).send('Unauthorized');
  }
  const userId = req.user.profile.id;
  const portfolio = userPortfolios.get(userId);
  if (!portfolio) {
    return res.send('No portfolio found');
  }
  const username = req.user.profile.username;
  const techSet = new Set();
  portfolio.forEach(project => {
    if (project.tech) {
      techSet.add(project.tech);
    }
  });
  const techSummary = Array.from(techSet);
  const generatedNarrative = `${username} is a developer who has built ${portfolio.length} projects using ${techSummary.join(', ')}. Their portfolio highlights practical experience and technical growth.`;
  // ✅ ADD THIS BLOCK HERE
const recommendations = [];

if (portfolio.length === 0) {
  recommendations.push('Start by saving your GitHub repositories to build your portfolio.');
} else {
  if (portfolio.length < 3) {
    recommendations.push('Consider adding more projects to showcase your skills. Aim for at least 3-5 projects.');
  } else if (portfolio.length < 5) {
    recommendations.push('Good progress! Continue building projects to strengthen your portfolio.');
  }

  if (techSummary.length < 3) {
    recommendations.push('Expand your tech stack by learning new technologies to show versatility.');
  }

  const projectsWithNoDescription = portfolio.filter(
    p => !p.summary || p.summary === 'No description' || p.summary.trim() === ''
  ).length;

  if (projectsWithNoDescription > 0) {
    recommendations.push(
      `${projectsWithNoDescription} project(s) have missing descriptions. Add clear descriptions to explain your work.`
    );
  }
}
  const projectsList = portfolio.map(project => 
    `<li><strong>${project.title}</strong> - ${project.summary} (${project.tech}) <a href="${project.link}">View</a></li>`
  ).join('');
  res.send(`
  <h1>${username}'s Portfolio</h1>
  <p>${generatedNarrative}</p>
  <p>Total Projects: ${portfolio.length}</p>
  <p>Technologies: ${techSummary.join(', ')}</p>

  <h2>Projects</h2>
  <ul>${projectsList}</ul>

  <h2>Recommendations</h2>
  <ul>
    ${recommendations.map(r => `<li>${r}</li>`).join('')}
  </ul>
`);
});

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
