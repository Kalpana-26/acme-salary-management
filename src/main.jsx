import React, { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Root as Label } from '@radix-ui/react-label';
import './style.css';

const money = (cents, currency) => new Intl.NumberFormat('en', {
  style: 'currency', currency, currencyDisplay: 'code',
}).format(cents / 100);
const number = new Intl.NumberFormat('en');

async function api(path, options) {
  const response = await fetch('/api/' + path, options);
  const data = await response.json();
  if (!response.ok) throw Object.assign(new Error(data.error), { status: response.status });
  return data;
}

function SalaryEditor({ id, close, onSaved }) {
  const dialog = useRef(null);
  const [record, setRecord] = useState(null);
  const [amount, setAmount] = useState('');
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  const [stale, setStale] = useState(false);

  function show(data) {
    setRecord(data);
    setAmount((data.employee.cents / 100).toFixed(2));
  }

  useEffect(() => {
    dialog.current.showModal();
    const controller = new AbortController();
    api('employees/' + id, { signal: controller.signal }).then(show).catch(error => {
      if (error.name !== 'AbortError') setError(error.message);
    });
    return () => controller.abort();
  }, [id]);

  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setError('');
    setSaved(false);
    try {
      if (stale) {
        show(await api('employees/' + id));
        setStale(false);
      } else {
        show(await api('employees/' + id, {
          method: 'PATCH', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ amount: amount.trim(), version: record.employee.version }),
        }));
        setSaved(true);
        onSaved();
      }
    } catch (error) {
      setError(error.message);
      if (error.status === 409) setStale(true);
    } finally {
      setBusy(false);
    }
  }

  return <dialog ref={dialog} aria-labelledby="record-title" onClose={close}
    onCancel={event => { if (busy) event.preventDefault(); }}>
    <div className="dialog-head">
      <h2 id="record-title">{record?.employee.name ?? 'Salary record'}</h2>
      <button disabled={busy} onClick={() => dialog.current.close()} aria-label="Close salary record">✕</button>
    </div>
    {error && <p className="error" role="alert">{error}</p>}
    {saved && <p className="success" role="status">Salary saved.</p>}
    {!record && !error && <p role="status">Loading salary record…</p>}
    {record && <>
      <p className="muted">{record.employee.role} · {record.employee.country} · #{id}</p>
      <form onSubmit={submit}>
        <div className="field"><Label htmlFor="salary-amount">Annual base salary ({record.employee.currency})</Label>
          <input id="salary-amount" required inputMode="decimal" value={amount} disabled={busy || stale}
            onChange={event => { setAmount(event.target.value); setSaved(false); }} />
        </div>
        <button className="primary" disabled={busy}>{stale ? 'Reload record' : 'Save salary'}</button>
      </form>
      <h3>Change history</h3>
      {record.history.length === 0 ? <p className="muted">No changes recorded.</p> :
        <ol className="history">{record.history.map(change => <li key={change.id}>
          <time dateTime={change.changed_at}>{new Date(change.changed_at).toLocaleString()}</time>
          <div>{money(change.previous_cents, record.employee.currency)} → {money(change.new_cents, record.employee.currency)}</div>
        </li>)}</ol>}
    </>}
  </dialog>;
}

function App() {
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState({ q: '', country: '', department: '', page: 1 });
  const [filters, setFilters] = useState({ countries: [], departments: [] });
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [filterError, setFilterError] = useState('');
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    api('filters', { signal: controller.signal }).then(setFilters).catch(error => {
      if (error.name !== 'AbortError') setFilterError(error.message);
    });
    return () => controller.abort();
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError('');
    api('employees?' + new URLSearchParams(query), { signal: controller.signal })
      .then(data => { setResult(data); setLoading(false); })
      .catch(error => {
        if (error.name !== 'AbortError') { setError(error.message); setLoading(false); }
      });
    return () => controller.abort();
  }, [query, revision]);

  const pages = Math.max(1, Math.ceil((result?.total ?? 0) / (result?.pageSize ?? 25)));
  function filter(event) {
    setQuery(current => ({ ...current, [event.target.name]: event.target.value, page: 1 }));
  }

  return <>
    <header className="masthead"><div className="wrap masthead-inner">
      <div className="brand"><span aria-hidden="true">A</span><div>ACME<small>People Operations</small></div></div>
    </div></header>
    <main className="wrap">
      <div className="page-heading">
        <div><h1>Salary management</h1>
          <p className="intro">Review annual base pay and manage employee salary records.</p></div>
        <div className="dataset"><span aria-hidden="true" /> Fictional employee data</div>
      </div>
      <section className="controls" aria-label="Employee filters">
        <form onSubmit={event => {
          event.preventDefault();
          setQuery(current => ({ ...current, q: search.trim(), page: 1 }));
        }}>
          <div className="field"><Label htmlFor="employee-search">Employee</Label>
            <input id="employee-search" type="search" maxLength={100} placeholder="Name or employee ID" value={search}
              onChange={event => setSearch(event.target.value)} /></div>
          <button className="primary">Search</button>
        </form>
        <div className="field"><Label htmlFor="country-filter">Country</Label><select id="country-filter" name="country" value={query.country} onChange={filter}>
          <option value="">All countries</option>{filters.countries.map(value => <option key={value}>{value}</option>)}
        </select></div>
        <div className="field"><Label htmlFor="department-filter">Department</Label><select id="department-filter" name="department" value={query.department} onChange={filter}>
          <option value="">All departments</option>{filters.departments.map(value => <option key={value}>{value}</option>)}
        </select></div>
        <button className="reset" onClick={() => { setSearch(''); setQuery({ q: '', country: '', department: '', page: 1 }); }}>Reset filters</button>
      </section>
      {filterError && <p className="error" role="alert">Filters could not load. {filterError}</p>}
      {loading ? <p role="status">Loading salary data…</p> : error ?
        <p className="error" role="alert">{error} <button onClick={() => setRevision(value => value + 1)}>Retry</button></p> :
        result && <>
          <section aria-labelledby="overview">
            <div className="section-heading"><h2 id="overview">Pay overview</h2><span>{number.format(result.total)} matching {result.total === 1 ? 'employee' : 'employees'}</span></div>
            <div className="cards">
              {result.summary.map(item => <article key={item.currency}>
                <div className="card-label"><strong>{item.currency}</strong><span>{number.format(item.headcount)} employees</span></div>
                <p className="average">{money(item.average, item.currency)}</p><p className="muted">Average annual salary</p>
                <dl><dt>Lowest</dt><dd>{money(item.minimum, item.currency)}</dd><dt>Highest</dt><dd>{money(item.maximum, item.currency)}</dd></dl>
              </article>)}
            </div>
          </section>
          <section className="directory" aria-labelledby="directory">
            <div className="directory-heading"><h2 id="directory">Employee directory</h2>
              {result.employees.length > 0 && <span>
                {number.format((result.page - 1) * result.pageSize + 1)}–{number.format((result.page - 1) * result.pageSize + result.employees.length)} of {number.format(result.total)}
              </span>}
            </div>
            {result.employees.length === 0 ? <p className="empty">No employees match your filters.</p> :
              <div className="table-wrap" tabIndex={0} aria-label="Scrollable employee directory">
                <table>
                  <thead><tr><th scope="col">Employee</th><th scope="col">Department</th><th scope="col">Country</th>
                    <th scope="col" className="pay">Annual base pay</th><th scope="col"><span className="sr-only">Action</span></th></tr></thead>
                  <tbody>{result.employees.map(employee => <tr key={employee.id}>
                    <th scope="row"><div className="person">
                      <span className="initials" aria-hidden="true">{employee.name.split(' ').slice(0, 2).map(part => part[0]).join('')}</span>
                      <div>{employee.name} <span className="employee-id">#{employee.id}</span><small>{employee.role}</small></div>
                    </div></th>
                    <td>{employee.department}</td><td>{employee.country}</td>
                    <td className="pay">{money(employee.cents, employee.currency)}</td>
                    <td><button aria-label={`Edit salary for ${employee.name} #${employee.id}`}
                      onClick={() => setSelected(employee.id)}>Edit</button></td>
                  </tr>)}</tbody>
                </table>
              </div>}
            {pages > 1 && <nav aria-label="Employee pages">
              <button disabled={query.page === 1} onClick={() => setQuery({ ...query, page: query.page - 1 })}>Previous</button>
              <span>Page {result.page} of {pages}</span>
              <button disabled={query.page >= pages} onClick={() => setQuery({ ...query, page: query.page + 1 })}>Next</button>
            </nav>}
          </section>
        </>}
    </main>
    {selected !== null && <SalaryEditor id={selected} close={() => setSelected(null)}
      onSaved={() => setRevision(value => value + 1)} />}
  </>;
}

createRoot(document.getElementById('root')).render(<App />);
