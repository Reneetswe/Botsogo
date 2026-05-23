import type { ClinicStatus } from '@/types';

interface ClinicCardProps {
  clinic: ClinicStatus;
}

export default function ClinicCard({ clinic }: ClinicCardProps) {
  return (
    <div className="clinic-row">
      <div>
        <div className="cn">{clinic.name}</div>
        {clinic.posts.map((post) => (
          <div className="post-ln" key={post.label}>
            <span className={`dot ${post.ok ? 'don' : 'doff'}`}></span>
            <span style={{ color: post.ok ? 'var(--green)' : 'var(--red)', fontSize: 11 }}>{post.label}</span>
          </div>
        ))}
        <div className="cd"><i className="ti ti-map-pin" style={{ fontSize: 11 }}></i> {clinic.distance}</div>
      </div>
      <div className="load-w"><div className="load-b"><div className={`lf ${clinic.loadClass}`} style={{ width: clinic.fillWidth }}></div></div><span className={`ln ${clinic.numberClass}`}>{clinic.count}</span></div>
    </div>
  );
}
