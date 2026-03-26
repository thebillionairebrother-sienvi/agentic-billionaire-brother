'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import {
    Crown,
    LayoutDashboard,
    FileText,
    Package,
    CalendarCheck,
    Settings,
    LogOut,
    ChevronLeft,
    Menu,
    Briefcase,
} from 'lucide-react';
import { useState } from 'react';
import type { User } from '@/lib/types';
import styles from './DashboardSidebar.module.css';

interface DashboardSidebarProps {
    user: User | null;
}

const navItems = [
    { href: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
    { href: '/office', icon: Briefcase, label: 'Your Office' },
    { href: '/ship-pack', icon: Package, label: 'Action Steps' },
    { href: '/board-meeting', icon: CalendarCheck, label: 'Weekly Check-in' },
    { href: '/brief', icon: FileText, label: 'Strategy Brief' },
    { href: '/settings', icon: Settings, label: 'Settings' },
];

export function DashboardSidebar({ user }: DashboardSidebarProps) {
    const pathname = usePathname();
    const router = useRouter();
    const [collapsed, setCollapsed] = useState(false);
    const [mobileOpen, setMobileOpen] = useState(false);
    const supabase = createClient();

    const handleSignOut = async () => {
        await supabase.auth.signOut();
        router.push('/');
        router.refresh();
    };

    return (
        <>
            {/* Mobile hamburger */}
            <button
                className={styles.mobileToggle}
                onClick={() => setMobileOpen(!mobileOpen)}
                aria-label="Toggle navigation"
            >
                <Menu size={24} />
            </button>

            {/* Overlay */}
            {mobileOpen && (
                <div
                    className={styles.overlay}
                    onClick={() => setMobileOpen(false)}
                />
            )}

            <aside
                className={`${styles.sidebar} ${collapsed ? styles.collapsed : ''} ${mobileOpen ? styles.mobileOpen : ''
                    }`}
            >
                {/* Brand */}
                <div className={styles.brand}>
                    <Link href="/dashboard" className={styles.brandLink}>
                        <div className={styles.logoMark}>
                            <Crown size={20} />
                        </div>
                        {!collapsed && (
                            <span className={styles.brandText}>Billionaire Brother</span>
                        )}
                    </Link>
                    <button
                        className={`${styles.collapseBtn} hide-mobile`}
                        onClick={() => setCollapsed(!collapsed)}
                        aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
                    >
                        <ChevronLeft
                            size={16}
                            style={{
                                transform: collapsed ? 'rotate(180deg)' : 'none',
                                transition: 'transform 200ms',
                            }}
                        />
                    </button>
                </div>

                {/* Nav */}
                <nav className={styles.nav}>
                    {navItems.map((item) => {
                        const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
                        return (
                            <Link
                                key={item.href}
                                href={item.href}
                                className={`${styles.navItem} ${isActive ? styles.active : ''}`}
                                onClick={() => setMobileOpen(false)}
                            >
                                <item.icon size={20} />
                                {!collapsed && <span>{item.label}</span>}
                            </Link>
                        );
                    })}
                </nav>

                {/* User */}
                <div className={styles.userSection}>
                    <div className={styles.userInfo}>
                        <div className={styles.avatar}>
                            {user?.display_name?.[0]?.toUpperCase() || user?.email?.[0]?.toUpperCase() || '?'}
                        </div>
                        {!collapsed && (
                            <div className={styles.userMeta}>
                                <span className={styles.userName}>
                                    {user?.display_name || 'User'}
                                </span>
                                <span className={styles.userEmail}>{user?.email}</span>
                            </div>
                        )}
                    </div>
                    <button
                        className={styles.signOutBtn}
                        onClick={handleSignOut}
                        title="Sign out"
                    >
                        <LogOut size={18} />
                    </button>
                </div>
            </aside>
        </>
    );
}
