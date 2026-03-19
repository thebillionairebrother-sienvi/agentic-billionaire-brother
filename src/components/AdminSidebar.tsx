'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import {
    Shield,
    Users,
    BarChart3,
    DollarSign,
    LogOut,
    ChevronLeft,
    Menu,
    ArrowLeft,
} from 'lucide-react';
import { useState } from 'react';
import styles from './AdminSidebar.module.css';

interface AdminSidebarProps {
    email: string;
}

const navItems = [
    { href: '/admin', icon: BarChart3, label: 'Overview' },
    { href: '/admin/costs', icon: DollarSign, label: 'Cost Monitor' },
];

export function AdminSidebar({ email }: AdminSidebarProps) {
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
            <button
                className={styles.mobileToggle}
                onClick={() => setMobileOpen(!mobileOpen)}
                aria-label="Toggle navigation"
            >
                <Menu size={24} />
            </button>

            {mobileOpen && (
                <div
                    className={styles.overlay}
                    onClick={() => setMobileOpen(false)}
                />
            )}

            <aside
                className={`${styles.sidebar} ${collapsed ? styles.collapsed : ''} ${mobileOpen ? styles.mobileOpen : ''}`}
            >
                {/* Brand */}
                <div className={styles.brand}>
                    <Link href="/admin" className={styles.brandLink}>
                        <div className={styles.logoMark}>
                            <Shield size={20} />
                        </div>
                        {!collapsed && (
                            <span className={styles.brandText}>Admin Panel</span>
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
                        const isActive = pathname === item.href;
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

                    <div className={styles.divider} />

                    <Link
                        href="/dashboard"
                        className={styles.navItem}
                        onClick={() => setMobileOpen(false)}
                    >
                        <ArrowLeft size={20} />
                        {!collapsed && <span>Back to App</span>}
                    </Link>
                </nav>

                {/* User */}
                <div className={styles.userSection}>
                    <div className={styles.userInfo}>
                        <div className={styles.avatar}>
                            <Shield size={14} />
                        </div>
                        {!collapsed && (
                            <div className={styles.userMeta}>
                                <span className={styles.userName}>Admin</span>
                                <span className={styles.userEmail}>{email}</span>
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
