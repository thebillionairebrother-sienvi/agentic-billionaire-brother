import { ClipboardList, Key, LayoutDashboard, CheckSquare, MessageSquareCode } from 'lucide-react';
import styles from './OnboardingClarity.module.css';

const STEPS = [
  {
    icon: ClipboardList,
    title: '1. Complete Business Questionnaire',
    desc: 'Input your metrics, goals, and bottlenecks. Derek audits your numbers to understand where you are bleeding time and cash.',
  },
  {
    icon: Key,
    title: '2. Select Your Strategy Path',
    desc: 'Derek generates three strategic routes. Choose the path that matches your risk tolerance, and lock in your execution contract.',
  },
  {
    icon: LayoutDashboard,
    title: '3. Access Your Office Command Center',
    desc: 'View your locked KPI (the only metric that matters right now) and active weekly milestones on your custom dashboard.',
  },
  {
    icon: CheckSquare,
    title: '4. Execute Weekly Action Steps',
    desc: 'Receive concrete, actionable directives every Monday. Complete them, mark them off, and track your daily consistency.',
  },
  {
    icon: MessageSquareCode,
    title: '5. Face the Weekly Board Meeting',
    desc: 'At the end of the week, report your execution quality (A to F). Derek recalibrates next week\'s tasks based on your grade.',
  },
];

export default function OnboardingClarity() {
  return (
    <div className={styles.container}>
      <div className={styles.stepper}>
        {STEPS.map((step, idx) => {
          const Icon = step.icon;
          return (
            <div key={idx} className={styles.step}>
              <div className={styles.iconContainer}>
                <div className={styles.iconCircle}>
                  <Icon size={18} />
                </div>
                {idx !== STEPS.length - 1 && <div className={styles.progressLine} />}
              </div>
              <div className={styles.content}>
                <h4 className={styles.title}>{step.title}</h4>
                <p className={styles.desc}>{step.desc}</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
