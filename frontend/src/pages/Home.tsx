import { Link } from 'react-router-dom';
import { ArrowRight, Code2, Zap, ShieldCheck } from 'lucide-react';

export default function Home() {
  return (
    <div style={containerStyle}>
      <div style={heroStyle}>
        <h1 style={titleStyle}>
          The Next-Gen <br />
          <span style={highlightStyle}>Competitive Programming</span> Engine.
        </h1>
        <p style={subtitleStyle}>
          Sharpen your algorithmic skills, compete in global contests, and master coding interviews with instant feedback.
        </p>
        
        <div style={actionContainerStyle}>
          <Link to="/problems" className="btn btn-primary" style={largeBtnStyle}>
            Start Coding <ArrowRight size={20} />
          </Link>
          <Link to="/contests" className="btn btn-outline" style={largeBtnStyle}>
            View Contests
          </Link>
        </div>
      </div>

      <div style={featuresGridStyle}>
        <FeatureCard 
          icon={<Zap color="var(--warning)" size={32} />}
          title="Instant Feedback"
          description="Get real-time verdicts on your code. See exactly where your logic fails and iterate quickly."
        />
        <FeatureCard 
          icon={<ShieldCheck color="var(--success)" size={32} />}
          title="Fair & Reliable"
          description="Compete with confidence. Our robust execution engine guarantees accurate and deterministic results."
        />
        <FeatureCard 
          icon={<Code2 color="var(--primary)" size={32} />}
          title="Pro Coding Experience"
          description="Enjoy a world-class editing environment with smart autocomplete, syntax highlighting, and modern themes."
        />
      </div>
    </div>
  );
}

function FeatureCard({ icon, title, description }: { icon: React.ReactNode, title: string, description: string }) {
  return (
    <div className="glass-panel" style={cardStyle}>
      <div style={iconWrapperStyle}>{icon}</div>
      <h3 style={cardTitleStyle}>{title}</h3>
      <p style={cardDescStyle}>{description}</p>
    </div>
  );
}

const containerStyle = {
  maxWidth: '1200px',
  margin: '0 auto',
  padding: '4rem 2rem',
  display: 'flex',
  flexDirection: 'column' as const,
  gap: '6rem',
};

const heroStyle = {
  textAlign: 'center' as const,
  maxWidth: '800px',
  margin: '0 auto',
  display: 'flex',
  flexDirection: 'column' as const,
  gap: '2rem',
  alignItems: 'center',
};

const titleStyle = {
  fontSize: '4.5rem',
  letterSpacing: '-0.04em',
  lineHeight: 1.1,
};

const highlightStyle = {
  background: 'linear-gradient(135deg, var(--primary) 0%, #a855f7 100%)',
  WebkitBackgroundClip: 'text',
  WebkitTextFillColor: 'transparent',
};

const subtitleStyle = {
  fontSize: '1.25rem',
  color: 'var(--text-muted)',
  maxWidth: '600px',
};

const actionContainerStyle = {
  display: 'flex',
  gap: '1.5rem',
  marginTop: '1rem',
};

const largeBtnStyle = {
  padding: '0.875rem 2rem',
  fontSize: '1.125rem',
};

const featuresGridStyle = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
  gap: '2rem',
};

const cardStyle = {
  padding: '2rem',
  display: 'flex',
  flexDirection: 'column' as const,
  gap: '1rem',
};

const iconWrapperStyle = {
  background: 'rgba(255,255,255,0.05)',
  width: '64px',
  height: '64px',
  borderRadius: '16px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  marginBottom: '0.5rem',
};

const cardTitleStyle = {
  fontSize: '1.25rem',
};

const cardDescStyle = {
  color: 'var(--text-muted)',
  lineHeight: 1.6,
};
