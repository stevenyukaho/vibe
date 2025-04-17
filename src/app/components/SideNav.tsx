import React, { useState, useEffect } from 'react';
import { SideNav, SideNavItems, SideNavLink } from '@carbon/react';
import { useRouter, usePathname } from 'next/navigation';
import { TestTool, DataTable, Report, Dashboard, Play } from '@carbon/icons-react';
import styles from './SideNav.module.scss';

export default function AppSideNav() {
    const router = useRouter();
    const pathname = usePathname();
    const [activeItem, setActiveItem] = useState('');
    useEffect(() => {
        if (!pathname) return;
        const segment = pathname.split('/')[1];
        setActiveItem(segment || '');
    }, [pathname]);
    const handleNavChange = (navItem: string) => {
        setActiveItem(navItem);
        router.push(`/${navItem}`);
    };

    return (
        <SideNav
            isFixedNav
            expanded={true}
            isChildOfHeader={true}
            aria-label="Side navigation"
            className={styles.sideNav}
        >
            <SideNavItems>
                <SideNavLink
                    renderIcon={TestTool}
                    isActive={activeItem === 'tests'}
                    onClick={() => handleNavChange('tests')}
                >
                    Tests
                </SideNavLink>
                <SideNavLink
                    renderIcon={DataTable}
                    isActive={activeItem === 'agents'}
                    onClick={() => handleNavChange('agents')}
                >
                    Agents
                </SideNavLink>
                <SideNavLink
                    renderIcon={Report}
                    isActive={activeItem === 'results'}
                    onClick={() => handleNavChange('results')}
                >
                    Results
                </SideNavLink>
                <SideNavLink
                    renderIcon={Dashboard}
                    isActive={activeItem === 'jobs'}
                    onClick={() => handleNavChange('jobs')}
                >
                    Jobs
                </SideNavLink>
                <SideNavLink
                    renderIcon={Play}
                    isActive={activeItem === 'run'}
                    onClick={() => handleNavChange('run')}
                >
                    Run Test
                </SideNavLink>
            </SideNavItems>
        </SideNav>
    );
}
