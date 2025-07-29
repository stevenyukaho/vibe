import React, { ReactNode } from 'react';
import { Tile } from '@carbon/react';

interface TileWrapperProps {
	children?: ReactNode;
	title?: string;
}

const TileWrapper: React.FC<TileWrapperProps> = ({ children, title }) => {
	return (
		<div style={{ marginBottom: '1rem' }}>
			<Tile>
				{title && <h3>{title}</h3>}
				{children}
			</Tile>
		</div>
	);
};

export default TileWrapper;
