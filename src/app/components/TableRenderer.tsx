import {
	DataTable,
	Table,
	TableHead,
	TableRow,
	TableHeader,
	TableBody,
	TableCell,
	Tag,
	Button,
} from '@carbon/react';
import { Edit, TrashCan, DataTable as DataTableIcon } from '@carbon/icons-react';

interface TableCell {
	id: string;
	info: {
		header: string;
	};
	value: string | number | boolean;
}

interface TableRendererProps {
	headers: Array<{ key: string; header: string }>;
	rows: Array<{ id: string; [key: string]: string | number | boolean }>;
	type: 'agent' | 'test' | 'result';
	onEdit?: (id: number) => void;
	onDelete?: (id: number) => void;
	onView?: (id: number) => void;
}

export default function TableRenderer({
	headers,
	rows,
	type,
	onEdit,
	onDelete,
	onView
}: TableRendererProps) {
	return (
		<DataTable rows={rows} headers={headers}>
			{({ rows, headers, getHeaderProps, getTableProps, getRowProps }) => (
				<Table {...getTableProps()}>
					<TableHead>
						<TableRow>
							{headers.map((header, index) => (
								<TableHeader {...getHeaderProps({ header })} key={`${header.key}-${index}`}>
									{header.header}
								</TableHeader>
							))}
						</TableRow>
					</TableHead>
					<TableBody>
						{rows.map((row, rowIndex) => (
							<TableRow {...getRowProps({ row })} key={`${row.id}-${rowIndex}`}>
								{row.cells.map((cell: TableCell, cellIndex) => {
									if (cell.info.header === 'success') {
										return (
											<TableCell key={`${cell.id}-${cellIndex}`}>
												<Tag type={cell.value ? 'green' : 'red'}>
													{cell.value ? 'Success' : 'Failed'}
												</Tag>
											</TableCell>
										);
									}
									if (cell.info.header === 'actions' && type === 'agent') {
										return (
											<TableCell key={`${cell.id}-${cellIndex}`}>
												<div style={{ display: 'flex', gap: '0.5rem' }}>
													<Button
														kind="ghost"
														size="sm"
														renderIcon={Edit}
														iconDescription="Edit agent"
														hasIconOnly
														onClick={() => {
															const rowId = row.id;
															const numericId = parseInt(rowId);
															if (!isNaN(numericId) && onEdit) {
																onEdit(numericId);
															}
														}}
													/>
													<Button
														kind="danger--ghost"
														size="sm"
														renderIcon={TrashCan}
														iconDescription="Delete agent"
														hasIconOnly
														onClick={() => {
															const rowId = row.id;
															const numericId = parseInt(rowId);
															if (!isNaN(numericId) && onDelete) {
																onDelete(numericId);
															}
														}}
													/>
												</div>
											</TableCell>
										);
									}
									if (cell.info.header === 'actions' && type === 'test') {
										return (
											<TableCell key={`${cell.id}-${cellIndex}`}>
												<div style={{ display: 'flex', gap: '0.5rem' }}>
													<Button
														kind="ghost"
														size="sm"
														renderIcon={Edit}
														iconDescription="Edit test"
														hasIconOnly
														onClick={() => {
															const rowId = row.id;
															const numericId = parseInt(rowId);
															if (!isNaN(numericId) && onEdit) {
																onEdit(numericId);
															}
														}}
													/>
													<Button
														kind="danger--ghost"
														size="sm"
														renderIcon={TrashCan}
														iconDescription="Delete test"
														hasIconOnly
														onClick={() => {
															const rowId = row.id;
															const numericId = parseInt(rowId);
															if (!isNaN(numericId) && onDelete) {
																onDelete(numericId);
															}
														}}
													/>
												</div>
											</TableCell>
										);
									}
									if (cell.info.header === 'actions' && type === 'result') {
										return (
											<TableCell key={`${cell.id}-${cellIndex}`}>
												<Button
													kind="ghost"
													size="sm"
													renderIcon={DataTableIcon}
													iconDescription="View details"
													hasIconOnly
													onClick={() => {
														const rowId = row.id;
														const numericId = parseInt(rowId);
														if (!isNaN(numericId) && onView) {
															onView(numericId);
														}
													}}
												/>
											</TableCell>
										);
									}
									return (
										<TableCell key={`${cell.id}-${cellIndex}`}>{cell.value}</TableCell>
									);
								})}
							</TableRow>
						))}
					</TableBody>
				</Table>
			)}
		</DataTable>
	);
}
