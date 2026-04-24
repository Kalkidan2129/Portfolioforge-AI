require('dotenv').config();
const express = require('express');
const session = require('express-session');
const passport = require('passport');
const GitHubStrategy = require('passport-github2').Strategy;
const { sql, connectDB } = require('./config/db');
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

let portfolioViews = 0;
let portfolioSaves = 0;

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
    summary: repo.description || 'No description available',
    link: repo.html_url,
    tech: repo.language || 'Not specified',
    lastUpdated: repo.updated_at
  }));
  res.json(portfolioRepos);
});



app.get('/api/portfolio', async (req, res) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const userId = String(req.user.profile.id);

  try {
    const result = await sql.query`
      SELECT PortfolioJson
      FROM UserPortfolios
      WHERE GitHubUserId = ${userId}
    `;

    if (result.recordset.length === 0) {
      return res.json({ message: 'No portfolio found' });
    }

    const portfolio = JSON.parse(result.recordset[0].PortfolioJson);
    res.json(portfolio);
  } catch (err) {
    console.error('❌ Error fetching portfolio from DB:', err);
    res.status(500).json({ error: 'Failed to fetch portfolio from database' });
  }
});

app.get('/api/portfolio/generate', async (req, res) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  const userId = String(req.user.profile.id);

let portfolio;

try {
  const result = await sql.query`
    SELECT PortfolioJson
    FROM UserPortfolios
    WHERE GitHubUserId = ${userId}
  `;

  if (result.recordset.length === 0) {
    return res.json({ message: 'No portfolio found' });
  }

  portfolio = JSON.parse(result.recordset[0].PortfolioJson);
} catch (err) {
  console.error('❌ Error generating portfolio from DB:', err);
  return res.status(500).json({ error: 'Failed to generate portfolio from database' });
}
  const username = req.user.profile.username;
  const techSet = new Set();
  portfolio.forEach(project => {
    if (project.tech) {
      techSet.add(project.tech);
    }
  });
  const techSummary = Array.from(techSet).filter(tech => tech !== 'Not specified');
  const portfolioSummary = `${username} is a passionate developer with hands-on experience building real-world applications using ${techSummary.join(', ')}. With ${portfolio.length} completed projects, their work demonstrates strong problem-solving skills, continuous learning, and practical development experience.`;
  res.json({
    owner: username,
    portfolioTitle: `${username}'s Portfolio`,
    projectCount: portfolio.length,
    projects: portfolio,
    techSummary,
    portfolioSummary
  });
});

app.get('/api/portfolio/generate-narrative', async (req, res) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  const userId = String(req.user.profile.id);

let portfolio;

try {
  const result = await sql.query`
    SELECT PortfolioJson
    FROM UserPortfolios
    WHERE GitHubUserId = ${userId}
  `;

  if (result.recordset.length === 0) {
    return res.json({ message: 'No portfolio found' });
  }

  portfolio = JSON.parse(result.recordset[0].PortfolioJson);
} catch (err) {
  console.error('❌ Error generating narrative from DB:', err);
  return res.status(500).json({ error: 'Failed to generate narrative from database' });
}
  const username = req.user.profile.username;
  const techSet = new Set();
  portfolio.forEach(project => {
    if (project.tech) {
      techSet.add(project.tech);
    }
  });
  const techSummary = Array.from(techSet).filter(tech => tech !== 'Not specified');
  const narrativePrompt = `Write a professional portfolio summary for ${username} who has built ${portfolio.length} projects using ${techSummary.join(', ')}.`;
  const generatedNarrative = `${username} is a passionate developer with hands-on experience building real-world applications using ${techSummary.join(', ')}. With ${portfolio.length} completed projects, their work demonstrates strong problem-solving skills, continuous learning, and practical development experience.`;
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
    summary: repo.description || 'No description available',
    link: repo.html_url,
    tech: repo.language || 'Not specified',
    lastUpdated: repo.updated_at
  }));
  const userId = req.user.profile.id;

await sql.query`
  MERGE UserPortfolios AS target
  USING (SELECT ${String(userId)} AS GitHubUserId) AS source
  ON target.GitHubUserId = source.GitHubUserId
  WHEN MATCHED THEN
    UPDATE SET
      PortfolioJson = ${JSON.stringify(portfolioRepos)},
      UpdatedAt = GETDATE()
  WHEN NOT MATCHED THEN
    INSERT (GitHubUserId, PortfolioJson, UpdatedAt)
    VALUES (${String(userId)}, ${JSON.stringify(portfolioRepos)}, GETDATE());
`;

await sql.query`
  MERGE PortfolioAnalytics AS target
  USING (SELECT ${String(userId)} AS GitHubUserId) AS source
  ON target.GitHubUserId = source.GitHubUserId
  WHEN MATCHED THEN
    UPDATE SET
      PortfolioSaves = PortfolioSaves + 1,
      UpdatedAt = GETDATE()
  WHEN NOT MATCHED THEN
    INSERT (GitHubUserId, PortfolioViews, PortfolioSaves, UpdatedAt)
    VALUES (${String(userId)}, 0, 1, GETDATE());
`;
res.json({ message: 'Portfolio saved to database', count: portfolioRepos.length });
});

app.get('/auth/github', passport.authenticate('github', { scope: ['user:email'] }));

app.get('/auth/github/callback', 
  passport.authenticate('github', { failureRedirect: '/' }),
  (req, res) => {
    res.send('Login successful');
  }
);

app.get('/portfolio/view', async (req, res) => {
  if (!req.user) {
    return res.status(401).send('Unauthorized');
  }
  const userId = String(req.user.profile.id);

let portfolio;

try {
  const result = await sql.query`
    SELECT PortfolioJson
    FROM UserPortfolios
    WHERE GitHubUserId = ${userId}
  `;

  if (result.recordset.length === 0) {
    return res.send('No portfolio found');
  }

  portfolio = JSON.parse(result.recordset[0].PortfolioJson);
} catch (err) {
  console.error('❌ Error loading portfolio from DB:', err);
  return res.status(500).send('Failed to load portfolio from database');
}
  await sql.query`
  MERGE PortfolioAnalytics AS target
  USING (SELECT ${String(userId)} AS GitHubUserId) AS source
  ON target.GitHubUserId = source.GitHubUserId
  WHEN MATCHED THEN
    UPDATE SET
      PortfolioViews = PortfolioViews + 1,
      UpdatedAt = GETDATE()
  WHEN NOT MATCHED THEN
    INSERT (GitHubUserId, PortfolioViews, PortfolioSaves, UpdatedAt)
    VALUES (${String(userId)}, 1, 0, GETDATE());
`;
  const username = req.user.profile.username;
  const techSet = new Set();
  portfolio.forEach(project => {
    if (project.tech) {
      techSet.add(project.tech);
    }
  });
  const techSummary = Array.from(techSet).filter(tech => tech !== 'Not specified');
  const generatedNarrative = `${username} is a passionate developer with hands-on experience building real-world applications using ${techSummary.join(', ')}. With ${portfolio.length} completed projects, their work demonstrates strong problem-solving skills, continuous learning, and practical development experience.`;
  
const recommendations = [];

if (portfolio.length === 0) {
  recommendations.push('Start by saving your GitHub repositories to build your portfolio.');
} else {
  

  const projectsWithNoDescription = portfolio.filter(
    p => 
      !p.summary || 
      p.summary === 'No description' || 
      p.summary === 'No description available' ||
      p.summary.trim() === ''
  ).length;

  if (projectsWithNoDescription > 0) {
    recommendations.push(
      `${projectsWithNoDescription} project(s) have missing descriptions. Add clear descriptions to explain your work.`
    );
  }
  if (techSummary.length < 3) {
    recommendations.push('Expand your tech stack by learning new technologies to show versatility.');
  }

  if (techSummary.includes('JavaScript')) {
    recommendations.push('Consider building a full-stack project to showcase end-to-end development skills.');
  }

  if (portfolio.length < 3) {
    recommendations.push('Consider adding more projects to showcase your skills. Aim for at least 3-5 projects.');
  } else if (portfolio.length < 5) {
    recommendations.push('Good progress! Continue building projects to strengthen your portfolio.');
  } else if (portfolio.length >= 5) {
    recommendations.push('Great portfolio size! Consider highlighting your top 2–3 projects to make your profile more focused.');
  }

  
}
  const projectsList = portfolio.map(project => 
    `<li><strong>${project.title}</strong> - ${project.summary} (${project.tech === 'Not specified' ? 'N/A' : project.tech}) <a href="${project.link}">View</a></li>`
  ).join('');
  const analyticsResult = await sql.query`
  SELECT PortfolioViews, PortfolioSaves
  FROM PortfolioAnalytics
  WHERE GitHubUserId = ${userId}
`;

const analytics = analyticsResult.recordset[0] || {
  PortfolioViews: 0,
  PortfolioSaves: 0
};
  res.send(`
  <style>
    body {
      font-family: Arial, sans-serif;
      margin: 0;
      padding: 40px 0;
      background-color: #f8f9fb;
      color: #222;
      line-height: 1.6;
      
    }
    .container {
      background: white;
      padding: 30px 40px;
      border-radius: 12px;
      max-width: 1000px;
      width: 90%;
      margin: 0 auto;
      box-shadow: 0 2px 12px rgba(0, 0, 0, 0.08);
    }  
    h1 {
      color: #1f3c88;
      margin-bottom: 20px;
    }
    h2 {
      color: #2c3e50;
      margin-top: 35px;
      margin-bottom: 10px;
      border-bottom: 2px solid #dfe6ee;
      padding-bottom: 5px;
    }
    p {
      margin: 10px 0;
      max-width: 1000px;
    }
    ul {
      padding-left: 25px;
    }
    li {
      margin-bottom: 10px;
    }
    a {
      color: #1f6feb;
      text-decoration: none;
      font-weight: bold;
    }
    a:hover {
      text-decoration: underline;
    }
  </style>
<div class="container">
  <h1>${username}'s Portfolio</h1>
  <p>${generatedNarrative}</p>
  <p><strong>Total Projects:</strong> ${portfolio.length}</p>
  <p><strong>Technologies:</strong> ${techSummary.join(', ')}</p>

  <h2>Projects</h2>
  <ul>${projectsList}</ul>

  <h2>Recommendations</h2>
  <ul>
    ${recommendations.map(r => `<li>${r}</li>`).join('')}
  </ul>
  <h2>Analytics</h2>
  <p>Portfolio Views: ${analytics.PortfolioViews}</p>
  <p>Portfolio Saves: ${analytics.PortfolioSaves}</p>
</div>
`);
});

app.get('/api/analytics', (req, res) => {
  res.json({
    portfolioViews,
    portfolioSaves
  });
});

connectDB().then(() => {
  app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
  });
});
