import Link from "next/link";
import { AccountPayButton } from "@/components/account/AccountPayButton";
import { customerPaymentLine, type OutstandingCustomerJobPay } from "@/lib/customer-jobs";
import { formatUsd } from "@/lib/money";

export function AccountOutstandingPays({
  jobs,
}: {
  jobs: OutstandingCustomerJobPay[];
}) {
  const totalCents = jobs.reduce((sum, job) => sum + job.pendingCents, 0);

  return (
    <section id="pay" className="rounded-2xl border border-ember/30 bg-ember/5 px-4 py-5">
      <h2 className="font-display text-2xl text-navy">Pay Trades on Demand</h2>
      {jobs.length === 0 ? (
        <p className="mt-2 text-sm text-muted">Nothing is owed to TOD right now.</p>
      ) : (
        <>
          <p className="mt-1 text-sm text-muted">
            Outstanding with TOD: {formatUsd(totalCents)}. Pay here through Stripe Checkout — you
            pay Trades on Demand, not the contractor.
          </p>
          <ul className="mt-4 space-y-3">
            {jobs.map((job) =>
              job.payments.map((payment) => (
                <li
                  key={payment.id}
                  className="rounded-xl border border-line bg-paper px-4 py-3"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-mono text-xs text-muted">{job.jobPublicId}</p>
                      <p className="text-sm text-navy">{customerPaymentLine(payment)}</p>
                    </div>
                    <p className="text-right font-semibold text-navy">
                      {formatUsd(payment.amountCents)}
                    </p>
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-3">
                    <AccountPayButton
                      jobId={job.jobPublicId}
                      paymentId={payment.id}
                      label={`Pay ${formatUsd(payment.amountCents)} to TOD`}
                    />
                    <Link
                      href={job.payPath}
                      className="text-sm font-semibold text-ember hover:underline"
                    >
                      Job pay page
                    </Link>
                  </div>
                </li>
              )),
            )}
          </ul>
        </>
      )}
    </section>
  );
}
