import { SideNav, SideNavItems, SideNavLink } from '@carbon/react';
import { TestTool, DataTable, Report, Dashboard, Play } from '@carbon/icons-react';
import styles from './SideNav.module.scss';

interface SideNavProps {
    activeItem: string;
    onNavChange: (navItem: string) => void;
}

export default function AppSideNav({ activeItem, onNavChange }: SideNavProps) {
    return (
        <SideNav
            isFixedNav
            expanded={true}
            isChildOfHeader={false}
            aria-label="Side navigation"
            className={styles.sideNav}
        >
            <SideNavItems>
                <SideNavLink
                    renderIcon={TestTool}
                    isActive={activeItem === 'tests'}
                    onClick={() => onNavChange('tests')}
                >
                    Tests
                </SideNavLink>
                <SideNavLink
                    renderIcon={DataTable}
                    isActive={activeItem === 'agents'}
                    onClick={() => onNavChange('agents')}
                >
                    Agents
                </SideNavLink>
                <SideNavLink
                    renderIcon={Report}
                    isActive={activeItem === 'results'}
                    onClick={() => onNavChange('results')}
                >
                    Results
                </SideNavLink>
                <SideNavLink
                    renderIcon={Dashboard}
                    isActive={activeItem === 'jobs'}
                    onClick={() => onNavChange('jobs')}
                >
                    Jobs
                </SideNavLink>
                <SideNavLink
                    renderIcon={Play}
                    isActive={activeItem === 'run'}
                    onClick={() => onNavChange('run')}
                >
                    Run Test
                </SideNavLink>
            </SideNavItems>
        </SideNav>
    );
}
