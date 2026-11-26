"use client";

import { Icon, type IconName } from "@/components/ui/Icon";
import { formatCount, formatNairaCompact, usePlatformStats } from "@/lib/platform-client";

export function TrustRow() {
    const { stats } = usePlatformStats();

    const signals: { icon: IconName; title: string; caption: string }[] = [
        { icon: "store", title: `${formatCount(stats.verifiedSellers)} verified sellers`, caption: "Approved shops on Oilinga" },
        { icon: "box", title: `${formatCount(stats.activeProducts)} live listings`, caption: "Ready to browse and buy" },
        { icon: "truck", title: `${formatCount(stats.deliveredOrders)} delivered orders`, caption: "Completed by sellers" },
        { icon: "wallet", title: formatNairaCompact(stats.totalTraded), caption: "Volume via verified payments" },
    ];

    return (
        <div className="oi-trust">
            {signals.map((signal) => (
                <div className="oi-trust__item" key={signal.title}>
                    <span className="oi-trust__icon">
                        <Icon name={signal.icon} size={20} />
                    </span>
                    <span className="oi-trust__text">
                        <strong className="oi-trust__title">{signal.title}</strong>
                        <small className="oi-trust__caption">{signal.caption}</small>
                    </span>
                </div>
            ))}
        </div>
    );
}
