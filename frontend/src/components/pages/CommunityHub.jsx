import { useState, useEffect } from "react";
import {
  MessageCircle,
  Users,
  Plus,
  Heart,
  Calendar,
  BookOpen,
  Award,
  TrendingUp,
} from "lucide-react";
import { toast } from "react-hot-toast";
import { postAPI } from "../../services/api";

const CommunityHub = () => {
  const [activeTab, setActiveTab] = useState("feed");
  const [posts, setPosts] = useState([]);
  const [stats, setStats] = useState({
    totalPosts: 0,
    featuredPosts: 0,
    recentPosts: 0,
    totalEngagement: 0,
  });
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState("all");

  // Load posts and stats on component mount
  useEffect(() => {
    loadPosts();
    loadStats();
  }, [selectedCategory]);

  const loadPosts = async () => {
    try {
      setLoading(true);
      const filters = {
        sortBy: "createdAt",
        sortOrder: "desc",
      };

      if (selectedCategory && selectedCategory !== "all") {
        filters.category = selectedCategory;
      }

      const response = await postAPI.getAll(1, 20, filters);
      setPosts(response.posts || []);
    } catch (error) {
      console.error("Error loading posts:", error);
      toast.error("Failed to load community posts");
    } finally {
      setLoading(false);
    }
  };

  const loadStats = async () => {
    try {
      const response = await postAPI.getStats();
      setStats({
        totalPosts: response.totalPosts || 0,
        featuredPosts: response.featuredPosts || 0,
        recentPosts: posts.length,
        totalEngagement: response.totalPosts * 5 || 0, // Approximate
      });
    } catch (error) {
      console.error("Error loading stats:", error);
    }
  };

  const handleLikePost = async (postId) => {
    const post = posts.find((p) => p._id === postId);
    const isCurrentlyLiked = post?.isLikedByCurrentUser;

    try {
      if (isCurrentlyLiked) {
        const response = await postAPI.unlike(postId);
        setPosts((prevPosts) =>
          prevPosts.map((p) =>
            p._id === postId
              ? { ...p, likes: response.likes, isLikedByCurrentUser: false }
              : p
          )
        );
        toast.success("Post unliked!");
      } else {
        const response = await postAPI.like(postId);
        setPosts((prevPosts) =>
          prevPosts.map((p) =>
            p._id === postId
              ? { ...p, likes: response.likes, isLikedByCurrentUser: true }
              : p
          )
        );
        toast.success("Post liked!");
      }
    } catch (error) {
      console.error("Error toggling like:", error);
      toast.error("Failed to update like status");
      // Reload posts to sync with backend
      loadPosts();
    }
  };

  const handleCategoryFilter = (category) => {
    setSelectedCategory(category);
  };

  const formatTimeAgo = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInMinutes = Math.floor((now - date) / (1000 * 60));

    if (diffInMinutes < 1) return "Just now";
    if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
    if (diffInMinutes < 1440)
      return `${Math.floor(diffInMinutes / 60)}h ago`;
    return `${Math.floor(diffInMinutes / 1440)}d ago`;
  };

  const getCategoryColor = (category) => {
    switch (category) {
      case "Health Tips":
        return "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400";
      case "Medical News":
        return "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400";
      case "Patient Stories":
        return "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400";
      case "Research":
        return "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400";
      default:
        return "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400";
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            Community Hub
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Connect, share knowledge, and engage with healthcare professionals
          </p>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-gray-950 p-6 rounded-lg border border-gray-200 dark:border-gray-800">
          <div className="flex items-center">
            <div className="bg-blue-100 dark:bg-blue-900/30 p-3 rounded-lg">
              <Users className="h-6 w-6 text-blue-600 dark:text-blue-400" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                Total Posts
              </p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {stats.totalPosts}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-950 p-6 rounded-lg border border-gray-200 dark:border-gray-800">
          <div className="flex items-center">
            <div className="bg-purple-100 dark:bg-purple-900/30 p-3 rounded-lg">
              <MessageCircle className="h-6 w-6 text-purple-600 dark:text-purple-400" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                Featured
              </p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {stats.featuredPosts}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-950 p-6 rounded-lg border border-gray-200 dark:border-gray-800">
          <div className="flex items-center">
            <div className="bg-green-100 dark:bg-green-900/30 p-3 rounded-lg">
              <Calendar className="h-6 w-6 text-green-600 dark:text-green-400" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                Recent
              </p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {posts.length}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-950 p-6 rounded-lg border border-gray-200 dark:border-gray-800">
          <div className="flex items-center">
            <div className="bg-orange-100 dark:bg-orange-900/30 p-3 rounded-lg">
              <TrendingUp className="h-6 w-6 text-orange-600 dark:text-orange-400" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                Engagement
              </p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {stats.totalEngagement}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="card dark:bg-gray-950 dark:border-gray-800">
        <div className="border-b border-gray-200 dark:border-gray-800">
          <nav className="flex space-x-8 px-6" aria-label="Tabs">
            <button
              onClick={() => setActiveTab("feed")}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === "feed"
                  ? "border-primary-600 text-primary-600 dark:text-primary-400"
                  : "border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300"
              }`}
            >
              Community Feed
            </button>
            <button
              onClick={() => setActiveTab("resources")}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === "resources"
                  ? "border-primary-600 text-primary-600 dark:text-primary-400"
                  : "border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300"
              }`}
            >
              Resources
            </button>
          </nav>
        </div>

        <div className="p-6">
          {activeTab === "feed" && (
            <div className="space-y-4">
              {/* Loading State */}
              {loading ? (
                <div className="text-center py-12">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto mb-4"></div>
                  <p className="text-gray-600 dark:text-gray-400">Loading posts...</p>
                </div>
              ) : posts.length === 0 ? (
                /* Empty State */
                <div className="text-center py-12 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg">
                  <MessageCircle className="h-16 w-16 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                    No posts yet
                  </h3>
                  <p className="text-gray-600 dark:text-gray-400 mb-4">
                    Be the first to share something with the community!
                  </p>
                  <button
                    className="btn-primary"
                    onClick={() => toast.success("Create post feature coming soon!")}
                  >
                    Create First Post
                  </button>
                </div>
              ) : (
                /* Community Posts */
                <>
                {posts.map((post) => (
                <div
                  key={post._id}
                  className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg p-6 hover:shadow-lg dark:hover:shadow-gray-900/50 transition-all duration-200"
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center">
                        <span className="text-white font-semibold text-sm">
                          {post.author
                            .split(" ")
                            .map((n) => n[0])
                            .join("")}
                        </span>
                      </div>
                      <div>
                        <h4 className="font-semibold text-gray-900 dark:text-white">
                          {post.author}
                        </h4>
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                          {post.category} • {formatTimeAgo(post.createdAt)}
                        </p>
                      </div>
                    </div>
                    <span
                      className={`px-2 py-1 text-xs font-semibold rounded-full ${getCategoryColor(
                        post.category
                      )}`}
                    >
                      {post.category}
                    </span>
                  </div>

                  <div className="space-y-2">
                    <h3 className="font-semibold text-gray-900 dark:text-white">
                      {post.title}
                    </h3>
                    <p className="text-gray-600 dark:text-gray-400">
                      {post.content}
                    </p>
                  </div>

                  <div className="flex items-center space-x-4 mt-4 pt-4 border-t border-gray-200 dark:border-gray-800">
                    <button
                      onClick={() => handleLikePost(post._id)}
                      className={`flex items-center space-x-1 ${
                        post.isLikedByCurrentUser
                          ? "text-red-500 hover:text-red-600"
                          : "text-gray-500 dark:text-gray-400 hover:text-red-500"
                      }`}
                    >
                      <Heart
                        className={`w-4 h-4 ${
                          post.isLikedByCurrentUser ? "fill-current" : ""
                        }`}
                      />
                      <span className="text-sm">{post.likes}</span>
                    </button>
                    <button className="flex items-center space-x-1 text-gray-500 dark:text-gray-400 hover:text-primary-600 dark:hover:text-primary-400">
                      <MessageCircle className="w-4 h-4" />
                      <span className="text-sm">{post.commentCount}</span>
                    </button>
                  </div>
                </div>
              ))}
                </>
              )}
            </div>
          )}

          {activeTab === "resources" && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg p-6">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                  Knowledge Base
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                  Access medical resources and guidelines
                </p>
                <div className="space-y-2">
                  <button
                    onClick={() =>
                      window.open(
                        "https://www.nccih.nih.gov/health/providers/clinicalpractice",
                        "_blank"
                      )
                    }
                    className="w-full flex items-center px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
                  >
                    <BookOpen className="w-4 h-4 mr-2" />
                    Clinical Guidelines
                  </button>
                  <button
                    onClick={() =>
                      window.open("https://reference.medscape.com/", "_blank")
                    }
                    className="w-full flex items-center px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
                  >
                    <BookOpen className="w-4 h-4 mr-2" />
                    Drug Reference
                  </button>
                  <button
                    onClick={() =>
                      window.open("https://www.mdcalc.com/", "_blank")
                    }
                    className="w-full flex items-center px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
                  >
                    <BookOpen className="w-4 h-4 mr-2" />
                    Medical Calculators
                  </button>
                </div>
              </div>

              <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg p-6">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                  Learning Modules
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                  Continuing medical education courses
                </p>
                <div className="space-y-2">
                  <button className="w-full flex items-center px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors">
                    <Award className="w-4 h-4 mr-2" />
                    CME Courses
                  </button>
                  <button className="w-full flex items-center px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors">
                    <Award className="w-4 h-4 mr-2" />
                    Certification Programs
                  </button>
                  <button className="w-full flex items-center px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors">
                    <Award className="w-4 h-4 mr-2" />
                    Webinar Series
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default CommunityHub;
