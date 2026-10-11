"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { UserButton, useUser } from "@clerk/nextjs";
import { NAV_GROUPS } from "@/lib/nav";
import { BrandMark } from "./brand";
import { Icon } from "./icons";
import styles from "./workspace.module.css";

export function Sidebar({ collapsed, onSearch, onToggle, onNavigate, onClose }: { collapsed: boolean; onSearch: () => void; onToggle?: () => void; onNavigate?: () => void; onClose?: () => void }) {
  const pathname = usePathname();
  const { user } = useUser();
  const accountName = user?.fullName || user?.username || "Your account";
  const accountEmail = user?.primaryEmailAddress?.emailAddress;
  return (
    <nav className={`${styles.sidebar} ${collapsed ? styles.rail : ""}`} aria-label="Primary">
      <div className={styles.brand}>
        <Link href="/" onClick={onNavigate} className={styles.brandLink} aria-label="Snapforge overview">
          <BrandMark className="size-8" />
          {!collapsed && <span><span className={styles.wordmark}>Snapforge<span className="text-accent-ink">.</span></span><span className={styles.workspaceLabel}>Your capture workspace</span></span>}
        </Link>
        {onClose && <button type="button" className={`${styles.iconButton} ml-auto`} onClick={onClose} aria-label="Close navigation"><Icon name="x" /></button>}
      </div>
      <div className={styles.sidebarTools}>
        <button type="button" className={styles.sidebarSearch} onClick={onSearch} aria-label="Search navigation" aria-keyshortcuts="Control+K Meta+K" title={collapsed ? "Search (Ctrl+K / ⌘K)" : undefined}><Icon name="search" />{!collapsed && <><span>Search</span><kbd>⌘ / Ctrl K</kbd></>}</button>
        {onToggle && <button type="button" className={styles.iconButton} aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"} aria-expanded={!collapsed} aria-controls="desktop-navigation" onClick={onToggle}><Icon name="panel" /></button>}
      </div>
      <div className={styles.navBody}>
        {NAV_GROUPS.map((group) => (
          <div key={group.label} className={styles.navGroup}>
            {!collapsed && <p className={styles.groupLabel}>{group.label}</p>}
            <ul>{group.items.map((item) => {
              const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
              return <li key={item.href}><Link href={item.href} onClick={onNavigate} aria-label={collapsed ? item.label : undefined} title={collapsed ? item.label : undefined} aria-current={active ? "page" : undefined} className={`${styles.navLink} ${active ? styles.active : ""}`}><Icon name={item.icon} className="size-4 shrink-0" />{!collapsed && <span>{item.label}</span>}</Link></li>;
            })}</ul>
          </div>
        ))}
      </div>
      <div className={styles.footer}>
        <Link href="/docs" onClick={onNavigate} aria-label="Getting started" title={collapsed ? "Getting started" : undefined} className={styles.startCard}>
          <span className={styles.startIcon}><Icon name="book" /></span>
          {!collapsed && <><span className={styles.startCopy}><strong>Getting started</strong><span>Build your first capture</span></span><Icon name="chevron" className="size-3 shrink-0" /></>}
        </Link>
        <div className={styles.profile}>
          <UserButton />
          {!collapsed && <><span className={styles.accountDetails}><strong title={accountName}>{accountName}</strong><span title={accountEmail}>{accountEmail || "Manage your account"}</span></span><Link href="/settings" onClick={onNavigate} className={styles.iconButton} aria-label="Account settings" title="Account settings"><Icon name="gear" className="size-4" /></Link></>}
        </div>
      </div>
    </nav>
  );
}
