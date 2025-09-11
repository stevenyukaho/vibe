import {
	DataTable,
	Table,
	TableHead,
	TableRow,
	TableHeader,
	TableBody,
	TableCell,
	Tag,
	Button
} from '@carbon/react';
import { Edit, TrashCan, ViewFilled, AiGenerate } from '@carbon/icons-react';
import SimilarityScoreDisplay from './SimilarityScoreDisplay';
import { TestResult } from '@/lib/api';

interface TableCell {
	id: string;
	info: {
		header: string;
	};
	value: string | number | boolean | TestResult | string[];
}

interface TableRendererProps {
	headers: Array<{ key: string; header: string }>;
	rows: Array<{ id: string; [key: string]: string | number | boolean | TestResult | string[] }>;
	type: 'agent' | 'test' | 'result' | 'conversation';
	onEdit?: (id: number) => void;
	onDelete?: (id: number) => void;
	onView?: (id: number) => void;
	onGenerate?: (id: number) => void;
}

export default function TableRenderer({
	headers,
	rows,
	type,
	onEdit,
	onDelete,
	onView,
	onGenerate
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
									if (cell.info.header === 'similarity_score') {
										return (
											<TableCell key={`${cell.id}-${cellIndex}`}>
												<SimilarityScoreDisplay result={cell.value as TestResult} />
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
													{onGenerate && (
														<Button
															kind="ghost"
															size="sm"
															renderIcon={AiGenerate}
															iconDescription="Generate Variations"
															hasIconOnly
															onClick={() => {
																const testId = parseInt(row.id, 10);
																if (!isNaN(testId)) onGenerate(testId);
															}}
														/>
													)}
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
													renderIcon={ViewFilled}
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
									if (cell.info.header === 'actions' && type === 'conversation') {
										return (
											<TableCell key={`${cell.id}-${cellIndex}`}>
												<div style={{ display: 'flex', gap: '0.5rem' }}>
													<Button
														kind="ghost"
														size="sm"
														renderIcon={ViewFilled}
														iconDescription="View conversation"
														hasIconOnly
														onClick={() => {
															const rowId = row.id;
															const numericId = parseInt(rowId);
															if (!isNaN(numericId) && onView) {
																onView(numericId);
															}
														}}
													/>
													<Button
														kind="ghost"
														size="sm"
														renderIcon={Edit}
														iconDescription="Edit conversation"
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
														iconDescription="Delete conversation"
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
									if (cell.info.header === 'tags') {
										return (
											<TableCell key={`${cell.id}-${cellIndex}`}>
												{Array.isArray(cell.value) 
													? (cell.value as string[]).map((tag, index) => (
														<Tag key={index} type="blue" size="sm" style={{ marginRight: '4px' }}>
															{tag}
														</Tag>
													))
													: String(cell.value || '')
												}
											</TableCell>
										);
									}
									return (
										<TableCell key={`${cell.id}-${cellIndex}`}>
											{typeof cell.value === 'object' && !Array.isArray(cell.value) ? JSON.stringify(cell.value) : String(cell.value)}
										</TableCell>
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
