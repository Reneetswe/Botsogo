import Link from 'next/link';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import LiveClinicLoad from '@/components/LiveClinicLoad';

export default async function Home() {
  return (
    <>
      <Navbar />
      <div className="screen active" id="screen-landing">
        <div className="hero">
          <div className="hero-overlay"></div>
          <div className="hero-inner">
            <h1 className="hero-h1">No more waiting<br />from 6 in the morning.</h1>
            <p className="hero-p">Check in from home, see which clinic is least busy, and arrive when you are actually needed not before dawn.</p>
            <div className="hero-actions">
              <Link className="btn-hero" href="/register">Register now</Link>
              <Link className="btn-hero-out" href="/login">I already have an account</Link>
            </div>
          </div>
        </div>
        <div className="strip">
          <div className="strip-item"><i className="ti ti-home-check"></i>Check in from home</div>
          <div className="strip-item"><i className="ti ti-chart-bar"></i>Live clinic load</div>
          <div className="strip-item"><i className="ti ti-stethoscope"></i>Smart digital triage</div>
          <div className="strip-item"><i className="ti ti-clock-check"></i>Staff accountability</div>
          <div className="strip-item"><i className="ti ti-device-mobile-message"></i>SMS alerts</div>
        </div>
        <div className="section" id="features">
          <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
            <div className="section-title">How Botsogo works</div>
            <div className="section-sub">Three interconnected features that cover your full journey from home to discharge.</div>
          </div>
          <div className="grid-3">
            <div className="feat-card"><div className="feat-img"><i className="ti ti-home-check"></i></div><div className="feat-body"><div className="feat-label">Feature 1</div><div className="feat-title">Pre-Arrival Check-In</div><p className="feat-p">Check into the queue before you leave home via the app or USSD *123# on any phone. Get a queue number and an estimated arrival slot so you are not sitting at the clinic from 6 AM.</p></div></div>
            <div className="feat-card"><div className="feat-img"><i className="ti ti-chart-bar"></i></div><div className="feat-body"><div className="feat-label">Feature 2</div><div className="feat-title">Clinic Load Visibility</div><p className="feat-p">Before checking in, see a live busyness map of all nearby clinics. If your closest clinic has 89 people and one 3 km away has 14, you choose no one forces you. Information spreads the load naturally.</p></div></div>
            <div className="feat-card"><div className="feat-img"><i className="ti ti-stethoscope"></i></div><div className="feat-body"><div className="feat-label">Feature 3</div><div className="feat-title">Digital Triage</div><p className="feat-p">When you arrive, a nurse enters your symptoms into the system. Critical cases go straight to the doctor. Mild cases are resolved by a nurse no doctor needed. Elderly patients are auto-prioritised.</p></div></div>
          </div>
        </div>
        <div className="info-band" id="about">
          <div className="info-text">
            <h2>Built for Botswana&apos;s public clinics</h2>
            <p>Long queues are not just inconvenient they are a barrier to care. Patients arrive before dawn, wait all day, and sometimes leave without being seen. Botsogo addresses this by giving patients information they have never had before.</p>
            <p>The system also holds clinics accountable. Staff clock in at every shift segment. If a nurse is not at their post after lunch, patients see that before they leave home and can choose a different clinic.</p>
            <p style={{ marginTop: '1rem', fontWeight: 600, fontSize: 15 }}>Ministry of Health · Republic of Botswana</p>
          </div>
          <div className="info-img"></div>
        </div>
        <LiveClinicLoad />
        <div className="stats-row">
          <div className="stat-item"><i className="ti ti-building-hospital"></i><div className="stat-num">24</div><div className="stat-lbl">Clinics connected</div></div>
          <div className="stat-item"><i className="ti ti-users"></i><div className="stat-num">3,400+</div><div className="stat-lbl">Patients served daily</div></div>
          <div className="stat-item"><i className="ti ti-clock-hour-4"></i><div className="stat-num">~40%</div><div className="stat-lbl">Reduction in wait time</div></div>
          <div className="stat-item"><i className="ti ti-device-mobile"></i><div className="stat-num">*123#</div><div className="stat-lbl">USSD — any phone</div></div>
        </div>
        <Footer />
      </div>
    </>
  );
}
