import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow
} from '@/components/ui/table';
import { StockItem } from './reportsUtils';

interface StockTabProps {
    stockMovement: StockItem[];
}

const StockTab = ({ stockMovement }: StockTabProps) => {
    return (
        <div className="space-y-4">
            <Card>
                <CardHeader>
                    <CardTitle>Pergerakan Stok</CardTitle>
                    <CardDescription>
                        Laporan stok masuk, keluar, dan sisa
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Produk</TableHead>
                                <TableHead>Stok Saat Ini</TableHead>
                                <TableHead>Min. Stok</TableHead>
                                <TableHead>Status</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {stockMovement.map((item, index) => (
                                <TableRow key={index}>
                                    <TableCell>{item.product}</TableCell>
                                    <TableCell>{item.remaining}</TableCell>
                                    <TableCell>{item.minStock}</TableCell>
                                    <TableCell>
                                        <Badge variant={item.remaining <= item.minStock ? "destructive" : "default"}>
                                            {item.remaining <= item.minStock ? "Rendah" : "Normal"}
                                        </Badge>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </div>
    );
};

export default StockTab;
