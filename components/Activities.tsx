import Image from "next/image";
import { motion } from "framer-motion";
import { activitiesData } from "@/mockData/portfolioData";

const Activities = () => {
  //   const activities = activitiesData.length > 0 ? activitiesData : [];
  const activities: typeof activitiesData = [];

  return (
    <motion.div
      key="activities"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.3 }}
      className="rounded-2xl overflow-hidden"
      style={{
        backgroundColor: "hsl(220, 20%, 10%)",
        border: "1px solid hsl(220, 15%, 18%)",
      }}
    >
      {activities.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr style={{ borderBottom: "1px solid hsl(220, 15%, 18%)" }}>
                <th className="text-left py-4 px-6 text-sm font-medium text-gray-400">
                  Type
                </th>
                <th className="text-left py-4 px-6 text-sm font-medium text-gray-400">
                  Source
                </th>
                <th className="text-left py-4 px-6 text-sm font-medium text-gray-400">
                  Destination
                </th>
                <th className="text-left py-4 px-6 text-sm font-medium text-gray-400">
                  Status
                </th>
                <th className="text-right py-4 px-6 text-sm font-medium text-gray-400">
                  Date
                </th>
              </tr>
            </thead>
            <tbody>
              {activities.map((activity, index) => (
                <motion.tr
                  key={index}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.05, duration: 0.3 }}
                  whileHover={{
                    backgroundColor: "rgba(255, 255, 255, 0.05)",
                  }}
                  className="transition-colors"
                  style={{
                    borderBottom: "1px solid rgba(255, 255, 255, 0.05)",
                  }}
                >
                  <td className="py-5 px-6">
                    <span className="font-medium">{activity.type}</span>
                  </td>
                  <td className="py-5 px-6">
                    <div className="flex items-center gap-3">
                      <div className="relative">
                        <div className="shrink-0 w-8 h-8">
                          <Image
                            src={activity.source.icon}
                            alt={`${activity.source.token} logo`}
                            width={32}
                            height={32}
                            className="object-contain w-full h-full"
                          />
                        </div>
                        <div
                          className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full flex items-center justify-center"
                          style={{ backgroundColor: "#7bb8ff" }}
                        >
                          <span className="text-[8px] font-bold">A</span>
                        </div>
                      </div>
                      <div>
                        <div className="font-medium">
                          {activity.source.token}
                        </div>
                        <div className="text-xs text-gray-400">
                          {activity.source.network}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="py-5 px-6">
                    <div className="flex items-center gap-3">
                      <div className="relative">
                        <div className="shrink-0 w-8 h-8">
                          <Image
                            src={activity.destination.icon}
                            alt={`${activity.destination.token} logo`}
                            width={32}
                            height={32}
                            className="object-contain w-full h-full"
                          />
                        </div>
                        <div
                          className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full flex items-center justify-center"
                          style={{ backgroundColor: "#7bb8ff" }}
                        >
                          <span className="text-[8px] font-bold">A</span>
                        </div>
                      </div>
                      <div>
                        <div className="font-medium">
                          {activity.destination.token}
                        </div>
                        <div className="text-xs text-gray-400">
                          {activity.destination.network}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="py-5 px-6">
                    <motion.span
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{
                        delay: index * 0.05 + 0.15,
                        duration: 0.3,
                      }}
                      className={`px-3 py-1.5 rounded-full text-sm font-medium border inline-block ${
                        activity.status === "Successful"
                          ? "text-green-400 border-green-400/30 bg-green-400/10"
                          : "text-red-400 border-red-400/30 bg-red-400/10"
                      }`}
                    >
                      {activity.status}
                    </motion.span>
                  </td>
                  <td className="py-5 px-6 text-right">
                    <div className="font-medium">{activity.date}</div>
                    <div className="text-xs text-gray-400">{activity.time}</div>
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.3 }}
          className="flex flex-col items-center justify-center py-20 px-6"
        >
          <div className="mb-6">
            <Image
              src="/assets/wallet.png"
              alt="No wallet connected"
              width={80}
              height={80}
              className="w-20 h-20 opacity-60"
            />
          </div>
          <h4 className="text-xl font-semibold mb-2">No wallet Connected</h4>
          <p className="text-gray-400 text-center">
            Connect wallet with holdings to view data.
          </p>
        </motion.div>
      )}
    </motion.div>
  );
};

export default Activities;
