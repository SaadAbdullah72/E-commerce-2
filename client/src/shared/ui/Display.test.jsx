import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Package } from 'lucide-react';
import { describe, expect, it, vi } from 'vitest';

import Badge from './Badge';
import { Card, CardFooter, CardHeader } from './Card';
import EmptyState from './EmptyState';
import ErrorState from './ErrorState';
import FilterChips from './FilterChips';
import { Input, Select, Textarea } from './Input';
import PageHeader from './PageHeader';
import { Table, TBody, Td, Th, THead, Tr } from './Table';
import TableSkeleton from './TableSkeleton';
import Timeline from './Timeline';
import Tooltip from './Tooltip';

describe('Badge', () => {
  it('shows its text and an optional icon', () => {
    render(
      <Badge tone="red" icon={Package}>
        Out of stock
      </Badge>,
    );
    const badge = screen.getByText('Out of stock');
    expect(badge.className).toContain('text-red-800');
    expect(badge.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
  });

  it('never goes below 12px text', () => {
    render(<Badge size="sm">x</Badge>);
    expect(screen.getByText('x').className).toContain('text-xs');
    expect(screen.getByText('x').className).not.toContain('text-[10px]');
  });

  it('falls back to gray for an unknown tone', () => {
    render(<Badge tone="nope">y</Badge>);
    expect(screen.getByText('y').className).toContain('bg-gray-100');
  });
});

describe('Input', () => {
  it('marks itself invalid and uses the red border', () => {
    render(<Input aria-label="Name" invalid />);
    const input = screen.getByLabelText('Name');
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(input.className).toContain('border-red-500');
  });

  it('is h-10 with a blue focus ring by default, and disabled looks disabled', () => {
    render(<Input aria-label="Name" disabled />);
    const input = screen.getByLabelText('Name');
    expect(input.className).toContain('h-10');
    expect(input.className).toContain('focus:ring-2');
    expect(input.className).toContain('disabled:bg-gray-50');
    expect(input).toBeDisabled();
  });

  it('pads the text away from a leading icon', () => {
    render(<Input aria-label="Search" leadingIcon={<span>i</span>} />);
    expect(screen.getByLabelText('Search').className).toContain('pl-10');
  });

  it('Select and Textarea share the same control look', () => {
    render(
      <>
        <Select aria-label="Pick">
          <option>a</option>
        </Select>
        <Textarea aria-label="Note" />
      </>,
    );
    expect(screen.getByLabelText('Pick').className).toContain('rounded-lg');
    expect(screen.getByLabelText('Note').className).toContain('min-h-20');
  });
});

describe('Card', () => {
  it('has a header and footer separated by lines', () => {
    render(
      <Card>
        <CardHeader>Head</CardHeader>
        body
        <CardFooter>Foot</CardFooter>
      </Card>,
    );
    expect(screen.getByText('Head').className).toContain('border-b');
    expect(screen.getByText('Foot').className).toContain('border-t');
  });

  it('lifts on hover only when interactive', () => {
    const { rerender } = render(<Card data-testid="card">x</Card>);
    expect(screen.getByTestId('card').className).not.toContain('hover:shadow-md');
    rerender(
      <Card interactive data-testid="card">
        x
      </Card>,
    );
    expect(screen.getByTestId('card').className).toContain('hover:shadow-md');
  });
});

describe('Table', () => {
  it('has a hidden caption, column headers and numeric cells', () => {
    render(
      <Table caption="Orders">
        <THead>
          <Tr interactive={false}>
            <Th>Order</Th>
            <Th align="right">Total</Th>
          </Tr>
        </THead>
        <TBody>
          <Tr>
            <Td>#1</Td>
            <Td numeric align="right">
              $5.00
            </Td>
          </Tr>
        </TBody>
      </Table>,
    );
    expect(screen.getByRole('table', { name: 'Orders' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Total' })).toHaveAttribute('scope', 'col');
    expect(screen.getByText('$5.00').className).toContain('tabular-nums');
  });
});

describe('TableSkeleton, EmptyState, ErrorState', () => {
  it('skeleton is a labelled status with 5 rows by default', () => {
    render(<TableSkeleton label="orders" />);
    const status = screen.getByRole('status', { name: 'Loading orders' });
    expect(status.children).toHaveLength(5);
  });

  it('empty state shows icon, message and the action', () => {
    render(
      <EmptyState
        icon={Package}
        title="No products yet"
        message="Add your first product."
        action={<button type="button">Add product</button>}
      />,
    );
    expect(screen.getByRole('heading', { name: 'No products yet' })).toBeInTheDocument();
    expect(screen.getByText('Add your first product.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add product' })).toBeInTheDocument();
  });

  it('error state is an alert with a retry that calls onRetry', async () => {
    const onRetry = vi.fn();
    render(<ErrorState message="We couldn't load the orders." onRetry={onRetry} />);
    expect(screen.getByRole('alert')).toHaveTextContent("We couldn't load the orders.");
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });
});

describe('PageHeader', () => {
  it('shows title, description and the action', () => {
    render(<PageHeader title="Products" description="Everything you sell." action={<button type="button">Add</button>} />);
    expect(screen.getByRole('heading', { name: 'Products' })).toBeInTheDocument();
    expect(screen.getByText('Everything you sell.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add' })).toBeInTheDocument();
  });
});

describe('FilterChips', () => {
  const options = [
    { value: 'all', label: 'All', count: 10 },
    { value: 'paid', label: 'Paid', count: 3 },
  ];

  it('marks the chosen chip with aria-pressed and shows counts', () => {
    render(<FilterChips label="Filter by status" options={options} value="paid" onChange={() => {}} />);
    expect(screen.getByRole('group', { name: 'Filter by status' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Paid/ })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: /All/ })).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByText('10')).toBeInTheDocument();
  });

  it('calls onChange with the value of the clicked chip', async () => {
    const onChange = vi.fn();
    render(<FilterChips label="Filter" options={options} value="all" onChange={onChange} />);
    await userEvent.click(screen.getByRole('button', { name: /Paid/ }));
    expect(onChange).toHaveBeenCalledWith('paid');
  });
});

describe('Timeline', () => {
  it('groups entries under a date heading and can open the detail', async () => {
    render(
      <Timeline
        groups={[
          {
            label: 'Today',
            items: [
              { id: '1', time: '10:30', title: 'Price changed', meta: 'admin@shop.test', details: <p>$5 to $6</p> },
              { id: '2', time: '09:00', title: 'Order shipped' },
            ],
          },
          { label: 'Yesterday', items: [{ id: '3', time: '16:00', title: 'Coupon added' }] },
        ]}
      />,
    );
    expect(screen.getByRole('heading', { name: 'Today' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Yesterday' })).toBeInTheDocument();
    expect(screen.getAllByRole('listitem')).toHaveLength(3);
    expect(screen.getByText('admin@shop.test')).toBeInTheDocument();
    await userEvent.click(screen.getByText('Show changes'));
    expect(screen.getByText('$5 to $6')).toBeVisible();
  });
});

describe('Tooltip', () => {
  it('shows on hover and links itself to the control with aria-describedby', async () => {
    render(
      <Tooltip content="Gross revenue includes refunds">
        <button type="button">Revenue info</button>
      </Tooltip>,
    );
    const button = screen.getByRole('button', { name: 'Revenue info' });
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
    await userEvent.hover(button);
    const tip = screen.getByRole('tooltip');
    expect(tip).toHaveTextContent('Gross revenue includes refunds');
    expect(button).toHaveAttribute('aria-describedby', tip.id);
    await userEvent.unhover(button);
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  });

  it('shows on keyboard focus and hides on Escape', async () => {
    render(
      <Tooltip content="Hello">
        <button type="button">Info</button>
      </Tooltip>,
    );
    await userEvent.tab();
    expect(screen.getByRole('tooltip')).toBeInTheDocument();
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  });
});
