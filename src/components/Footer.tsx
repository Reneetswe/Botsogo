import Link from 'next/link';

export default function Footer() {
  return (
    <footer className="site-footer">
      <div className="footer-l">
        <strong>Botsogo</strong> &nbsp;·&nbsp; Because your time matters too &nbsp;·&nbsp; Ministry of Health, Botswana &nbsp;·&nbsp; &copy; 2026
        &nbsp;·&nbsp; <i className="ti ti-phone" style={{ fontSize: 11 }}></i> +267 363 5000 &nbsp;·&nbsp; <span className="ussd-tag">USSD *123#</span>
      </div>
      <Link className="staff-lnk" href="/staff/login"><i className="ti ti-lock" style={{ fontSize: 13 }}></i> Staff portal</Link>
    </footer>
  );
}
